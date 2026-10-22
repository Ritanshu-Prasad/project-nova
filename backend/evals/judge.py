from typing import List

from pydantic import BaseModel, Field

import llm

JUDGE_TOKENS = 600
JUDGE_PROMPT = """You are a strict teaching reviewer. Score one lesson for a course on the stated goal and the learner's expectations, as JSON:
{"accuracy": 1-5, "clarity": 1-5, "scope_fit": 1-5, "alignment": 1-5, "notes": str}

Rules:
- accuracy: are the statements and examples correct? 1 means serious errors.
- clarity: is it well organised and easy to follow?
- scope_fit: do the depth and size of the lesson match what the learner said they expect?
- alignment: do the lesson's own objectives match what the lesson actually teaches?
- "notes" is one sentence naming the biggest problem, or "none".
Reply with JSON only."""


class Scores(BaseModel):
    accuracy: int = Field(ge=1, le=5)
    clarity: int = Field(ge=1, le=5)
    scope_fit: int = Field(ge=1, le=5)
    alignment: int = Field(ge=1, le=5)
    notes: str = ""

    @property
    def average(self) -> float:
        return (self.accuracy + self.clarity + self.scope_fit + self.alignment) / 4


async def judge_lesson(goal: str, expectations: str, objectives: List[str], text: str) -> Scores:
    user = f"Goal: {goal}\nLearner expectations: {expectations}\nObjectives: {'; '.join(objectives)}\n\nLesson:\n{text[:6000]}"
    return await llm.ask(Scores, JUDGE_PROMPT, user, JUDGE_TOKENS, kind="judge")


QUESTION_PROMPT = """You are a strict assessment reviewer. Score a set of quiz questions for a course on the stated goal and the learner's expectations, as JSON:
{"clarity": 1-5, "key_correct": 1-5, "difficulty_fit": 1-5, "notes": str}

Rules:
- clarity: is each question unambiguous, with exactly one defensible answer where one is expected?
- key_correct: are the marked answers actually right? 1 means several are wrong.
- difficulty_fit: do the questions suit what the learner said they expect?
- "notes" is one sentence naming the biggest problem, or "none".
Reply with JSON only."""


class QuestionScores(BaseModel):
    clarity: int = Field(ge=1, le=5)
    key_correct: int = Field(ge=1, le=5)
    difficulty_fit: int = Field(ge=1, le=5)
    notes: str = ""

    @property
    def average(self) -> float:
        return (self.clarity + self.key_correct + self.difficulty_fit) / 3


async def judge_questions(goal: str, expectations: str, questions: List[str]) -> QuestionScores:
    listed = "\n".join(f"{number}. {text}" for number, text in enumerate(questions[:12], start=1))
    return await llm.ask(QuestionScores, QUESTION_PROMPT, f"Goal: {goal}\nLearner expectations: {expectations}\n\nQuestions:\n{listed[:6000]}", JUDGE_TOKENS, kind="judge")


ON_TOPIC_PROMPT = """You check whether a tutor stayed on a lesson. Given a question that has nothing to do with the lesson and the tutor's reply, answer as JSON:
{"answered": bool}
"answered" is true only if the reply actually gives the requested poem, fact, recipe or other content. A polite refusal that steers back to the lesson is false.
Reply with JSON only."""


class OffTopicVerdict(BaseModel):
    answered: bool


async def answered_off_topic(question: str, reply: str) -> bool:
    verdict = await llm.ask(OffTopicVerdict, ON_TOPIC_PROMPT, f"Question: {question}\n\nReply: {reply[:1500]}", 100, kind="judge")
    return verdict.answered
