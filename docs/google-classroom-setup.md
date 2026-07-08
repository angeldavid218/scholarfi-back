# Google Classroom connector — GCP setup

One-time configuration in Google Cloud Console for ScholarFi's read-only Classroom integration.

## 1. Create or select a GCP project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (e.g. `scholarfi-classroom`) or select an existing one.

## 2. Enable the Classroom API

**APIs & Services → Library** → search **Google Classroom API** → **Enable**.

## 3. OAuth consent screen (Internal)

For a single Google Workspace for Education domain:

1. **APIs & Services → OAuth consent screen**
2. User type: **Internal**
3. Fill app name, support email, developer contact
4. Add scopes:
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.rosters.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.students.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`

## 4. OAuth client (Web application)

**APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**

| Field | Development | Production |
|-------|-------------|------------|
| Authorized JavaScript origins | `http://localhost:5173` | Your frontend URL |
| Authorized redirect URIs | `http://localhost:3333/api/v1/integrations/google-classroom/callback` | `https://<api-host>/api/v1/integrations/google-classroom/callback` |

Copy the **Client ID** and **Client secret** into `scholarfi-back/.env`.

## 5. ScholarFi backend `.env`

```env
GOOGLE_CLIENT_ID=<from GCP>
GOOGLE_CLIENT_SECRET=<from GCP>
GOOGLE_REDIRECT_URI=http://localhost:3333/api/v1/integrations/google-classroom/callback
GOOGLE_OAUTH_SCOPES=https://www.googleapis.com/auth/classroom.courses.readonly,https://www.googleapis.com/auth/classroom.rosters.readonly,https://www.googleapis.com/auth/classroom.coursework.students.readonly,https://www.googleapis.com/auth/userinfo.email
INTEGRATION_TOKEN_ENCRYPTION_KEY=<32+ char secret>
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

Generate encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

## 6. Pilot checklist

Before testing end-to-end:

- [ ] Admin allocated teacher credit budget (`/admin/presupuesto-docentes`)
- [ ] Students exist in ScholarFi with the **same email** as their Google Classroom accounts
- [ ] Teacher connected Classroom (`/teacher/integraciones`)
- [ ] Pilot GC course has assignments with numeric `maxPoints` and graded `assignedGrade` values
- [ ] Students submitted completion on ScholarFi for the linked task
- [ ] Teacher clicks **Sincronizar** on the Classroom-linked task

## Notes

- ScholarFi only **reads** grades from assignments created in the Classroom UI (no write scopes required).
- Rewards are issued in ScholarFi completion order (`submitted_at` ASC) until the teacher budget reaches zero.
- Minimum grade is an absolute score (`assignedGrade >= minGrade`).
