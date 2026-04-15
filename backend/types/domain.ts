export type TagKey = 'math' | 'lang' | 'flang' | 'sci' | 'hist_geo' | 'civic';

export type UserRecord = {
  id: string;
  username: string;
  role: string;
  math_exp: number;
  lang_exp: number;
  flang_exp: number;
  sci_exp: number;
  hist_geo_exp: number;
  civic_exp: number;
};

export type QuizRecord = {
  id: string;
  created_by: string | null;
  tag: TagKey;
  quiz_title: string;
  question_count: number;
  display_count: number;
  category_display_counts: Record<string, number>;
  target_user_ids: string[];
  is_global: boolean;
  questions: Array<{
    type: 'MCQ' | 'FILL';
    category: string;
    has_image: boolean;
    image_url: string;
    question_text: string;
    options: string[];
    answer: string;
    explanation: string;
  }>;
  high_score: number;
  is_published: boolean;
};
