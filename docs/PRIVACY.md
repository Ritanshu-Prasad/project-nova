# What NOVA does with your data

## Learning goals
A goal you type is sent to the AI provider (Nebius) to write your course and to check that it is not meant to cause serious harm. Finished courses are cached for one hour so that the same goal is answered faster. Goals are not written to the server logs; a short hash stands in for them.

## Uploaded documents
- PDFs are read on the server and their text is sent to the AI provider to write lessons and questions.
- The text of your pages is kept for 30 days under a secret key so the tutor can answer questions from your documents, and then deleted automatically. Removing the course in the app deletes it straight away (`DELETE /api/courses/documents/{key}`). Without a configured Redis store (local development) it is kept in memory only and disappears when the server restarts.
- Limits: 5 files, 50 MB and 100 pages in total.

## Progress and accounts
Your courses, progress and profile are stored under your account by the existing account service. 
## Your responsibility
Only upload material you are allowed to share with a third-party service. Do not upload personal or confidential documents.
