DO $$
BEGIN
  IF to_regclass('public.quiz_questions') IS NULL THEN
    RAISE EXCEPTION 'Create public.quiz_questions before enabling chaptered quizzes.';
  END IF;
  IF to_regclass('public.quiz_attempts') IS NULL THEN
    RAISE EXCEPTION 'Create public.quiz_attempts before enabling chaptered quizzes.';
  END IF;
END;
$$;

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS chapter_number integer;

DO $$
DECLARE
  unassigned_count integer;
BEGIN
  SELECT count(*) INTO unassigned_count
  FROM public.quiz_questions
  WHERE chapter_number IS NULL;

  IF unassigned_count > 70 THEN
    RAISE EXCEPTION 'There are % unassigned quiz questions, but chaptered quizzes support at most 70. Remove or organize questions before rerunning this migration.', unassigned_count;
  END IF;
END;
$$;

WITH numbered_questions AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS row_number
  FROM public.quiz_questions
  WHERE chapter_number IS NULL
)
UPDATE public.quiz_questions AS question
SET chapter_number = ((numbered_questions.row_number - 1) / 10 + 1)::integer
FROM numbered_questions
WHERE question.id = numbered_questions.id;

ALTER TABLE public.quiz_questions
  ALTER COLUMN chapter_number SET DEFAULT 1,
  ALTER COLUMN chapter_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quiz_questions'::regclass
      AND conname = 'quiz_questions_chapter_number_check'
  ) THEN
    ALTER TABLE public.quiz_questions
      ADD CONSTRAINT quiz_questions_chapter_number_check
      CHECK (chapter_number BETWEEN 1 AND 7);
  END IF;
END;
$$;

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS chapter_number integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quiz_attempts'::regclass
      AND conname = 'quiz_attempts_chapter_number_check'
  ) THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_chapter_number_check
      CHECK (chapter_number IS NULL OR chapter_number BETWEEN 1 AND 7);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_quiz_chapter_question_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  existing_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(82715, NEW.chapter_number);

  SELECT count(*) INTO existing_count
  FROM public.quiz_questions
  WHERE chapter_number = NEW.chapter_number
    AND id IS DISTINCT FROM NEW.id;

  IF existing_count >= 10 THEN
    RAISE EXCEPTION 'Chapter % already has 10 questions.', NEW.chapter_number;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_quiz_chapter_question_limit ON public.quiz_questions;
CREATE TRIGGER enforce_quiz_chapter_question_limit
  BEFORE INSERT OR UPDATE OF chapter_number
  ON public.quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quiz_chapter_question_limit();

CREATE TABLE IF NOT EXISTS public.quiz_chapter_progress (
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chapter_number integer NOT NULL CHECK (chapter_number BETWEEN 1 AND 7),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, chapter_number)
);

ALTER TABLE public.quiz_chapter_progress ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.quiz_chapter_progress TO authenticated;

DROP POLICY IF EXISTS "Students can view their own quiz chapter progress"
  ON public.quiz_chapter_progress;
CREATE POLICY "Students can view their own quiz chapter progress"
  ON public.quiz_chapter_progress
  FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()));

DROP FUNCTION IF EXISTS public.complete_quiz_chapter(integer, integer);

CREATE OR REPLACE FUNCTION public.complete_quiz_chapter(
  p_chapter_number integer,
  p_answers jsonb
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

  SELECT count(*) INTO question_count
  FROM public.quiz_questions
  WHERE chapter_number = p_chapter_number;

  IF question_count <> 10 THEN
    RAISE EXCEPTION 'Chapter % must have exactly 10 questions before it can be submitted.', p_chapter_number;
  END IF;

  IF p_answers IS NULL
    OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object'
    OR CASE
      WHEN jsonb_typeof(p_answers) = 'object'
      THEN jsonb_object_length(p_answers) <> question_count
      ELSE true
    END
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
    chapter_number
  )
  VALUES (
    current_student_id,
    calculated_score,
    question_count,
    calculated_percentage,
    p_chapter_number
  );

  INSERT INTO public.quiz_chapter_progress (student_id, chapter_number)
  VALUES (current_student_id, p_chapter_number)
  ON CONFLICT (student_id, chapter_number) DO NOTHING;

  RETURN QUERY
  SELECT calculated_score, question_count, calculated_percentage;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_quiz_chapter(integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_quiz_chapter(integer, jsonb) TO authenticated;
