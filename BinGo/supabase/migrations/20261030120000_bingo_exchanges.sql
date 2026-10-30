-- Supabase-backed item requests and encrypted exchange conversations.
CREATE TABLE IF NOT EXISTS public.exchanges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    listing_title text NOT NULL CHECK (char_length(btrim(listing_title)) BETWEEN 1 AND 60),
    listing_category text NOT NULL CHECK (listing_category IN (
        'Books', 'Clothes', 'E-Waste', 'Furniture', 'Home goods', 'Electronics', 'Kids'
    )),
    requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'completed')),
    diverted_kg numeric(6,1),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (listing_id, requester_id),
    CHECK (requester_id <> owner_id)
);

CREATE INDEX IF NOT EXISTS exchanges_requester_updated
    ON public.exchanges (requester_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS exchanges_owner_updated
    ON public.exchanges (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.exchange_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_id uuid NOT NULL REFERENCES public.exchanges(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    encrypted_payload jsonb NOT NULL CHECK (
        (
            encrypted_payload->>'protocol' = 'ECDH-P256-AES-256-GCM-v1'
            AND jsonb_typeof(encrypted_payload->'iv') = 'string'
            AND char_length(encrypted_payload->>'iv') = 16
            AND jsonb_typeof(encrypted_payload->'ciphertext') = 'string'
            AND char_length(encrypted_payload->>'ciphertext') BETWEEN 24 AND 5500
        ) IS TRUE
    ),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exchange_messages_exchange_created
    ON public.exchange_messages (exchange_id, created_at, id);

CREATE TABLE IF NOT EXISTS public.exchange_encryption_keys (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    public_key text NOT NULL CHECK (char_length(public_key) BETWEEN 80 AND 100),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_encryption_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exchanges_read_participant ON public.exchanges;
CREATE POLICY exchanges_read_participant
    ON public.exchanges FOR SELECT TO authenticated
    USING (requester_id = (SELECT auth.uid()) OR owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS exchanges_insert_requester ON public.exchanges;
CREATE POLICY exchanges_insert_requester
    ON public.exchanges FOR INSERT TO authenticated
    WITH CHECK (
        requester_id = (SELECT auth.uid())
        AND status = 'requested'
        AND EXISTS (
            SELECT 1
              FROM public.listings AS l
             WHERE l.id = exchanges.listing_id
               AND l.owner_id = exchanges.owner_id
               AND l.status = 'available'
        )
    );

DROP POLICY IF EXISTS exchange_messages_read_participant ON public.exchange_messages;
CREATE POLICY exchange_messages_read_participant
    ON public.exchange_messages FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.exchanges AS e
             WHERE e.id = exchange_id
               AND ((e.requester_id = (SELECT auth.uid()) AND e.owner_id <> (SELECT auth.uid()))
                 OR (e.owner_id = (SELECT auth.uid()) AND e.requester_id <> (SELECT auth.uid())))
        )
    );

DROP POLICY IF EXISTS exchange_messages_insert_sender ON public.exchange_messages;
CREATE POLICY exchange_messages_insert_sender
    ON public.exchange_messages FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.exchanges AS e
             WHERE e.id = exchange_id
               AND (e.requester_id = (SELECT auth.uid()) OR e.owner_id = (SELECT auth.uid()))
        )
    );

DROP POLICY IF EXISTS exchange_keys_read_self_or_peer ON public.exchange_encryption_keys;
CREATE POLICY exchange_keys_read_self_or_peer
    ON public.exchange_encryption_keys FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.exchanges AS e
             WHERE (e.requester_id = (SELECT auth.uid()) AND e.owner_id = user_id)
                OR (e.owner_id = (SELECT auth.uid()) AND e.requester_id = user_id)
        )
    );

DROP POLICY IF EXISTS exchange_keys_write_self ON public.exchange_encryption_keys;
CREATE POLICY exchange_keys_write_self
    ON public.exchange_encryption_keys FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS exchange_keys_update_self ON public.exchange_encryption_keys;
CREATE POLICY exchange_keys_update_self
    ON public.exchange_encryption_keys FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.exchanges, public.exchange_messages, public.exchange_encryption_keys FROM anon;
GRANT SELECT, INSERT ON public.exchanges TO authenticated;
GRANT SELECT, INSERT ON public.exchange_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exchange_encryption_keys TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_exchange(p_exchange_id uuid)
RETURNS TABLE (status text, diverted_kg numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    exchange_status text;
    item_category text;
    item_status text;
    credited_kg numeric(6,1);
BEGIN
    SELECT e.status, l.category, l.status
      INTO exchange_status, item_category, item_status
      FROM public.exchanges AS e
      JOIN public.listings AS l ON l.id = e.listing_id
     WHERE e.id = p_exchange_id
       AND (e.requester_id = (SELECT auth.uid()) OR e.owner_id = (SELECT auth.uid()))
     FOR UPDATE OF e, l;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Exchange not found.' USING ERRCODE = 'P0002';
    END IF;

    IF exchange_status = 'completed' THEN
        RETURN QUERY
            SELECT 'completed'::text, e.diverted_kg::numeric
              FROM public.exchanges AS e WHERE e.id = p_exchange_id;
        RETURN;
    END IF;

    IF item_status <> 'available' THEN
        RAISE EXCEPTION 'This item is no longer available.' USING ERRCODE = '23514';
    END IF;

    credited_kg := CASE item_category
        WHEN 'Books' THEN 2.0
        WHEN 'Clothes' THEN 1.0
        WHEN 'E-Waste' THEN 1.5
        WHEN 'Furniture' THEN 3.0
        WHEN 'Home goods' THEN 3.0
        WHEN 'Electronics' THEN 1.5
        WHEN 'Kids' THEN 1.0
        ELSE 0.0
    END;

    UPDATE public.exchanges AS e
       SET status = 'completed', diverted_kg = credited_kg, updated_at = now()
     WHERE e.id = p_exchange_id;
    UPDATE public.listings AS l
       SET status = 'completed', updated_at = now()
      FROM public.exchanges AS e
     WHERE e.id = p_exchange_id AND l.id = e.listing_id;

    RETURN QUERY SELECT 'completed'::text, credited_kg::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_community_impact()
RETURNS TABLE (
    diverted_kg numeric,
    completed_exchanges bigint,
    community_diverted_kg numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        COALESCE(SUM(e.diverted_kg) FILTER (
            WHERE e.requester_id = (SELECT auth.uid()) OR e.owner_id = (SELECT auth.uid())
        ), 0)::numeric,
        COUNT(*) FILTER (
            WHERE e.status = 'completed'
              AND (e.requester_id = (SELECT auth.uid()) OR e.owner_id = (SELECT auth.uid()))
        ),
        COALESCE(SUM(e.diverted_kg), 0)::numeric
    FROM public.exchanges AS e
    WHERE e.status = 'completed';
$$;

CREATE OR REPLACE FUNCTION public.touch_exchange(p_exchange_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.exchanges AS e
       SET updated_at = now()
     WHERE e.id = p_exchange_id
       AND (e.requester_id = (SELECT auth.uid()) OR e.owner_id = (SELECT auth.uid()));

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Exchange not found.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_exchange(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_community_impact() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_exchange(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_exchange(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_impact() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_exchange(uuid) TO authenticated;
