/*
|--------------------------------------------------------------------------
| Scheduler
|--------------------------------------------------------------------------
|
| Recurring jobs registered on web boot (upserted into queue_schedules).
| `npm run queue:work` dispatches due schedules and processes the classroom queue.
|
*/

import SyncAllClassroomTasksJob from '#jobs/sync_all_classroom_tasks_job'
import env from '#start/env'

const cron = env.get('CLASSROOM_NIGHTLY_SYNC_CRON') ?? '0 2 * * *'
const timezone = env.get('CLASSROOM_NIGHTLY_SYNC_TIMEZONE') ?? 'America/Mexico_City'

await SyncAllClassroomTasksJob.schedule({})
  .id('nightly-classroom-sync')
  .cron(cron)
  .timezone(timezone)
  .run()
