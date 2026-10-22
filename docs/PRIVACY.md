# What NOVA does with your data

## Learning goals
A goal you type is sent to the AI provider (Nebius) to write your course and to check that it is not meant to cause serious harm. Finished courses are cached for one hour so that the same goal is answered faster. Goals are not written to the server logs; a short hash stands in for them.

## Uploaded documents
- PDFs are read on the server and their text is sent to the AI provider to write lessons and questions.
- The text of your pages is kept for 30 days under a secret key so the tutor can answer questions from your documents, and then deleted automatically. Removing the course in the app deletes it straight away (`DELETE /api/courses/documents/{key}`). Without a configured Redis store (local development) it is kept in memory only and disappears when the server restarts.
- Limits: 5 files, 50 MB and 100 pages in total.

## Progress and accounts
Your courses, progress and profile are stored under your account by the existing account service. 
## Request records
So the operator can find slow or failed requests, NOVA keeps a short record of each request that used the model: time, route, status, token counts, cost and remarks, for 7 days. It does not contain what you typed or what the model answered unless the operator sets `NOVA_TRACE_CONTENT=on`, in which case those texts (cut to 2,000 characters each) are kept in NOVA's own store for the same 7 days.

## Statistics and abuse protection
- To check how hard questions really are, the app sends, after a quiz, a short hash of each question and whether the answer was right. These counts contain no account or device identifier.
- To limit abuse the server counts requests per network address for up to an hour; these counters are not linked to anything else and expire on their own.

## Your responsibility
Only upload material you are allowed to share with a third-party service. Do not upload personal or confidential documents.
