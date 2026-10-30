-- Browser-only features for free static hosting. The browser uses only the
-- Supabase publishable key; RLS and column grants protect submitted data.
CREATE TABLE IF NOT EXISTS public.dumping_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('Mixed waste', 'Plastic', 'Construction')),
    description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 500),
    latitude double precision NOT NULL CHECK (latitude BETWEEN 10.8 AND 11.25),
    longitude double precision NOT NULL CHECK (longitude BETWEEN 76.75 AND 77.25),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dumping_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dumping_reports_read_public ON public.dumping_reports;
CREATE POLICY dumping_reports_read_public
    ON public.dumping_reports FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS dumping_reports_insert_authenticated ON public.dumping_reports;
CREATE POLICY dumping_reports_insert_authenticated
    ON public.dumping_reports FOR INSERT TO authenticated
    WITH CHECK (reporter_id = (SELECT auth.uid()));

REVOKE ALL ON public.dumping_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT (category, latitude, longitude, created_at)
    ON public.dumping_reports TO anon, authenticated;
GRANT INSERT (category, description, latitude, longitude)
    ON public.dumping_reports TO authenticated;

CREATE TABLE IF NOT EXISTS public.design_survey_responses (
    user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    visual_clarity integer NOT NULL CHECK (visual_clarity BETWEEN 1 AND 5),
    icon_readability integer NOT NULL CHECK (icon_readability BETWEEN 1 AND 5),
    layout_appeal integer NOT NULL CHECK (layout_appeal BETWEEN 1 AND 5),
    submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.design_survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS design_survey_insert_own ON public.design_survey_responses;
CREATE POLICY design_survey_insert_own
    ON public.design_survey_responses FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS design_survey_update_own ON public.design_survey_responses;
CREATE POLICY design_survey_update_own
    ON public.design_survey_responses FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.design_survey_responses FROM PUBLIC, anon, authenticated;
GRANT INSERT (visual_clarity, icon_readability, layout_appeal)
    ON public.design_survey_responses TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_design_survey(
    p_visual_clarity integer,
    p_icon_readability integer,
    p_layout_appeal integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'Sign in to submit survey ratings.' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.design_survey_responses (
        user_id, visual_clarity, icon_readability, layout_appeal
    ) VALUES (
        (SELECT auth.uid()), p_visual_clarity, p_icon_readability, p_layout_appeal
    )
    ON CONFLICT (user_id) DO UPDATE
        SET visual_clarity = EXCLUDED.visual_clarity,
            icon_readability = EXCLUDED.icon_readability,
            layout_appeal = EXCLUDED.layout_appeal,
            submitted_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_design_survey_summary()
RETURNS TABLE (
    response_count bigint,
    visual_clarity numeric,
    icon_readability numeric,
    layout_appeal numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COUNT(*)::bigint,
           AVG(s.visual_clarity)::numeric,
           AVG(s.icon_readability)::numeric,
           AVG(s.layout_appeal)::numeric
      FROM public.design_survey_responses AS s;
$$;

REVOKE ALL ON FUNCTION public.get_design_survey_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_design_survey_summary() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_design_survey(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_design_survey(integer, integer, integer) TO authenticated;
