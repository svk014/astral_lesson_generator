import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PRIVATE_SUPABASE_SECRET_KEY;

console.log('Supabase URL:', supabaseUrl ? 'set' : 'not set');
console.log('Service Role Key:', serviceRoleKey ? 'set' : 'not set');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase env vars not set');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function getLessonById(lessonId: string) {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch lesson: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Lesson ${lessonId} not found`);
  }

  return data;
}

export async function markLessonCompleted(lessonId: string) {
  const { error } = await supabase
    .from('lessons')
    .update({ status: 'completed' })
    .eq('id', lessonId);

  if (error) {
    throw new Error(`Failed to update lesson: ${error.message}`);
  }
}