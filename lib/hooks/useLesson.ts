import { useQuery } from '@tanstack/react-query';

export type Lesson = {
  id: string;
  outline: string;
  status: string;
  jsx_source: string | null;
  compiled_code: string | null;
  jsx_storage_path: string | null;
  jsx_public_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

async function fetchLesson(lessonId: string): Promise<Lesson> {
  const response = await fetch(`/api/lessons/${lessonId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch lesson: ${response.statusText}`);
  }
  const data = await response.json();
  // API returns { lesson, compiledCode }, but we want just the lesson with all fields
  return data.lesson || data;
}

/**
 * Hook to fetch a single lesson with smart polling
 * - Polls every 2 seconds while generating
 * - Slows down to 5 seconds for intermediate states
 * - Stops polling once completed or failed
 */
export function useLesson(lessonId: string | null) {
  return useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => fetchLesson(lessonId!),
    enabled: !!lessonId,
    refetchInterval: (query) => {
      const data = query.state.data as Lesson | undefined;
      if (!data) return 2000;

      // Stop polling once terminal states reached
      if (data.status === 'completed' || data.status === 'failed') {
        return false;
      }

      // Poll more frequently while actively generating
      if (
        data.status === 'running' ||
        data.status === 'generating_jsx' ||
        data.status === 'validating_jsx' ||
        data.status === 'generating_images' ||
        data.status === 'storing_jsx'
      ) {
        return 2000; // Every 2 seconds
      }

      // Default: poll every 5 seconds for other states
      return 5000;
    },
  });
}

async function fetchLessons(): Promise<Lesson[]> {
  const response = await fetch('/api/lessons');
  if (!response.ok) {
    throw new Error(`Failed to fetch lessons: ${response.statusText}`);
  }
  const data = await response.json();
  return data.lessons || [];
}

/**
 * Hook to fetch all lessons with polling
 * Useful for showing recent lessons list that updates as new lessons are generated
 */
export function useLessons() {
  return useQuery({
    queryKey: ['lessons'],
    queryFn: fetchLessons,
    // Poll every 3 seconds for recent lessons
    refetchInterval: 3000,
  });
}
