# Groups and roster

Cloud Campus can mirror class rosters using institution-scoped groups. Groups support an `external_source` of `cloud_campus` for future sync tooling.

## Create subject

```http
POST /api/v1/institutions/subjects
Authorization: Bearer <school_admin_token>
Content-Type: application/json

{
  "name": "Mathematics",
  "code": "MATH-101"
}
```

**Role:** `school_admin`

## List subjects

```http
GET /api/v1/institutions/subjects
Authorization: Bearer <school_admin_token>
```

## Create group (class section)

```http
POST /api/v1/institutions/groups
Authorization: Bearer <school_admin_token>
Content-Type: application/json

{
  "subjectId": 5,
  "name": "Mathematics 7A",
  "section": "7A",
  "code": "MATH-7A"
}
```

**Role:** `school_admin`

Groups created through Cloud Campus integrations should use `external_source: cloud_campus` when a dedicated sync endpoint is available. Today, groups created via this API are tagged `manual` unless imported through CSV or Classroom flows.

## Sync group teachers

```http
POST /api/v1/institutions/groups/:id/teachers
Authorization: Bearer <school_admin_token>
Content-Type: application/json

{ "userIds": [30, 31] }
```

Replaces the teacher set for the group with the provided user IDs.

## Sync group students

```http
POST /api/v1/institutions/groups/:id/students
Authorization: Bearer <school_admin_token>
Content-Type: application/json

{ "userIds": [44, 45, 46] }
```

Replaces the student set for the group.

## Recommended roster flow (v1)

1. Provision teachers and students via `POST /institutions/users`.
2. Create subjects and groups for each Cloud Campus class.
3. Sync membership with the teacher/student sync endpoints.
4. Optionally link teacher↔student pairs with `POST /institutions/teacher-students`.

## Future: dedicated Cloud Campus sync

ScholarFi reserves `cloud_campus` as a group external source. A future endpoint (similar to Google Classroom sync) may accept bulk roster payloads from Cloud Campus and upsert users/groups in one call.
