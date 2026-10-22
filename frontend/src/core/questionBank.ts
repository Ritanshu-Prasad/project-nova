// Types of the module content and question bank the backend writes (see backend/schemas/*.schema.json).
// The backend picks the quiz from the bank (question_bank.pick_quiz); the app only receives the picked questions.

export interface ModuleContent {
  title: string;
  overview: string;
  learning_objectives: string[];
  requires_code: boolean;
  code_reason: string;
  key_terms: { term: string; definition: string }[];
  sections: ModuleSection[];
}

export interface ModuleSection {
  heading: string;
  explanation: string;
  example?: string;
  common_mistake?: string;
  quick_check?: { question: string; answer: string };
  analogy?: string;
  action_steps?: string[];
  code?: { language: string; snippet: string; explanation: string };
}

export type OptionId = 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
export interface QuestionOption { id: OptionId; text: string }

interface QuestionBase {
  question_id: string;
  question_text: string;
  explanation: string;
  evidence: string;
  section_index: number;
}

export type BankQuestion =
  | (QuestionBase & { type: 'mcq'; options: QuestionOption[]; correct_answer: 'a' | 'b' | 'c' | 'd' })
  | (QuestionBase & { type: 'msq'; options: QuestionOption[]; correct_answer: OptionId[] })
  | (QuestionBase & { type: 'true_false'; correct_answer: boolean })
  // items are in the correct order; `shown` is the scrambled order, added when the backend picks a quiz
  | (QuestionBase & { type: 'order'; items: string[]; shown?: string[] });

export interface QuestionBank { questions: BankQuestion[] }
