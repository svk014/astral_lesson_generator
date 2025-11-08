import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lesson } from './useLesson';

type SubmitOutlinePayload = {
  outline: string;
};

type SubmitOutlineResponse = {
  lesson: Lesson;
};

async function submitOutline(payload: SubmitOutlinePayload): Promise<SubmitOutlineResponse> {
  const response = await fetch('/api/lessons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit outline: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Hook to submit an outline and get optimistic updates
 * - Immediately shows new lesson in list
 * - Automatically fetches updates as it generates
 */
export function useSubmitOutline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitOutline,
    onMutate: async (variables) => {
      // Cancel any ongoing lessons list queries
      await queryClient.cancelQueries({ queryKey: ['lessons'] });

      // Get the previous lessons list
      const previousLessons = queryClient.getQueryData(['lessons']) as Lesson[] | undefined;

      // Create a temporary lesson object
      const tempLesson: Lesson = {
        id: `temp-${Date.now()}`,
        outline: variables.outline,
        status: 'queued',
        jsx_source: null,
        compiled_code: null,
        jsx_storage_path: null,
        jsx_public_url: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Optimistically add the new lesson to the top of the list
      queryClient.setQueryData(['lessons'], (old: Lesson[] | undefined) => [
        tempLesson,
        ...(old || []),
      ]);

      return { previousLessons };
    },
    onError: (error, variables, context) => {
      // Rollback to previous lessons list on error
      if (context?.previousLessons) {
        queryClient.setQueryData(['lessons'], context.previousLessons);
      }
    },
    onSuccess: (data) => {
      // Replace the temp lesson with the real one
      queryClient.setQueryData(['lessons'], (old: Lesson[] | undefined) => {
        if (!old) return [data.lesson];
        return old.map((lesson) =>
          lesson.id.startsWith('temp-') ? data.lesson : lesson
        );
      });

      // Prefetch the new lesson data to start polling
      queryClient.setQueryData(['lesson', data.lesson.id], data.lesson);
    },
  });
}
