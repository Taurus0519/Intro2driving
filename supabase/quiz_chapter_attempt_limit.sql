  DO $$
  BEGIN
    IF to_regclass('public.quiz_attempts') IS NULL
      OR to_regclass('public.quiz_questions') IS NULL
      OR to_regclass('public.quiz_chapter_progress') IS NULL
    THEN
      RAISE EXCEPTION 'Run quiz_chapters.sql and create quiz_attempts before enabling chapter attempt limits.';
    END IF;
  END;
  $$;

  ALTER TABLE public.quiz_attempts
    ADD COLUMN IF NOT EXISTS submission_id uuid;

  CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_student_submission_id_uidx
    ON public.quiz_attempts (student_id, submission_id)
    WHERE submission_id IS NOT NULL;

  DROP TRIGGER IF EXISTS enforce_quiz_attempt_limit ON public.quiz_attempts;
  DROP TRIGGER IF EXISTS enforce_quiz_chapter_attempt_limit ON public.quiz_attempts;

  CREATE OR REPLACE FUNCTION public.enforce_quiz_chapter_attempt_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
  DECLARE
    existing_attempts bigint;
  BEGIN
    IF NEW.student_id IS NULL OR NEW.chapter_number IS NULL THEN
      RAISE EXCEPTION 'A student and chapter are required for each quiz attempt.';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        NEW.student_id::text || ':' || NEW.chapter_number::text,
        0
      )
    );

    SELECT count(*)
    INTO existing_attempts
    FROM public.quiz_attempts
    WHERE student_id = NEW.student_id
      AND chapter_number = NEW.chapter_number;

    IF existing_attempts >= 3 THEN
      RAISE EXCEPTION USING
        errcode = 'P0001',
        message = 'You have used all 3 quiz attempts for this chapter.';
    END IF;

    RETURN NEW;
  END;
  $$;

  REVOKE EXECUTE ON FUNCTION public.enforce_quiz_chapter_attempt_limit()
    FROM PUBLIC, anon, authenticated;

  CREATE TRIGGER enforce_quiz_chapter_attempt_limit
    BEFORE INSERT ON public.quiz_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_quiz_chapter_attempt_limit();

  DROP FUNCTION IF EXISTS public.complete_quiz_chapter(integer, jsonb);

  CREATE OR REPLACE FUNCTION public.complete_quiz_chapter(
    p_chapter_number integer,
    p_answers jsonb,
    p_submission_id uuid
  )
  RETURNS TABLE (
    score integer,
    total_questions integer,
    percentage integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
  DECLARE
    current_student_id uuid := auth.uid();
    student_role text;
    question_count integer;
    calculated_score integer;
    calculated_percentage integer;
    existing_attempt public.quiz_attempts%ROWTYPE;
  BEGIN
    IF current_student_id IS NULL THEN
      RAISE EXCEPTION 'Sign in before submitting a quiz chapter.';
    END IF;

    SELECT role INTO student_role
    FROM public.profiles
    WHERE id = current_student_id;

    IF student_role IS DISTINCT FROM 'student' THEN
      RAISE EXCEPTION 'Only students can submit quiz chapters.';
    END IF;

    IF p_chapter_number IS NULL OR p_chapter_number NOT BETWEEN 1 AND 7 THEN
      RAISE EXCEPTION 'Choose a valid quiz chapter.';
    END IF;

    IF p_submission_id IS NULL THEN
      RAISE EXCEPTION 'A submission ID is required.';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        current_student_id::text || ':' || p_chapter_number::text,
        0
      )
    );

    SELECT *
    INTO existing_attempt
    FROM public.quiz_attempts
    WHERE student_id = current_student_id
      AND submission_id = p_submission_id;

    IF FOUND THEN
      IF existing_attempt.chapter_number <> p_chapter_number THEN
        RAISE EXCEPTION 'This submission ID was already used for another chapter.';
      END IF;

      RETURN QUERY
      SELECT
        existing_attempt.score,
        existing_attempt.total_questions,
        existing_attempt.percentage;
      RETURN;
    END IF;

    SELECT count(*) INTO question_count
    FROM public.quiz_questions
    WHERE chapter_number = p_chapter_number;

    IF question_count <> 10 THEN
      RAISE EXCEPTION 'Chapter % must have exactly 10 questions before it can be submitted.', p_chapter_number;
    END IF;

    IF p_answers IS NULL
      OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object'
    THEN
      RAISE EXCEPTION 'Answer all 10 questions in this chapter before submitting.';
    END IF;

    IF jsonb_object_length(p_answers) <> question_count
      OR EXISTS (
        SELECT 1
        FROM public.quiz_questions
        WHERE chapter_number = p_chapter_number
          AND NOT (p_answers ? id::text)
      )
    THEN
      RAISE EXCEPTION 'Answer all 10 questions in this chapter before submitting.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.quiz_questions AS question
      WHERE question.chapter_number = p_chapter_number
        AND CASE
          WHEN jsonb_typeof(p_answers -> question.id::text) = 'number'
            AND (p_answers ->> question.id::text) ~ '^[0-9]+$'
          THEN (p_answers ->> question.id::text)::numeric >= jsonb_array_length(question.options)
          ELSE true
        END
    ) THEN
      RAISE EXCEPTION 'One or more submitted answers are invalid.';
    END IF;

    IF p_chapter_number > 1 AND NOT EXISTS (
      SELECT 1
      FROM public.quiz_chapter_progress
      WHERE quiz_chapter_progress.student_id = current_student_id
        AND quiz_chapter_progress.chapter_number = p_chapter_number - 1
    ) THEN
      RAISE EXCEPTION 'Complete the previous chapter before submitting this one.';
    END IF;

    SELECT (count(*) FILTER (
      WHERE (p_answers ->> question.id::text)::integer = question.correct_index
    ))::integer
    INTO calculated_score
    FROM public.quiz_questions AS question
    WHERE question.chapter_number = p_chapter_number;

    calculated_percentage := round(calculated_score * 100.0 / question_count)::integer;

    INSERT INTO public.quiz_attempts (
      student_id,
      score,
      total_questions,
      percentage,
      chapter_number,
      submission_id
    )
    VALUES (
      current_student_id,
      calculated_score,
      question_count,
      calculated_percentage,
      p_chapter_number,
      p_submission_id
    );

    INSERT INTO public.quiz_chapter_progress (student_id, chapter_number)
    VALUES (current_student_id, p_chapter_number)
    ON CONFLICT (student_id, chapter_number) DO NOTHING;

    RETURN QUERY
    SELECT calculated_score, question_count, calculated_percentage;
  END;
  $$;

  REVOKE ALL ON FUNCTION public.complete_quiz_chapter(integer, jsonb, uuid)
    FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.complete_quiz_chapter(integer, jsonb, uuid)
    TO authenticated;
