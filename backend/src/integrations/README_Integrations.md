# Core-HRMS Integration Mappings & Automated Sync

This directory contains integration adapters and schemas that allow synchronization of employee directories from external HRMS applications.

## Design Architecture

1. **Adapter Registry (`registry.js`)**:
   - Maps provider strings (e.g. `bamboohr`, `workday`) to adapter classes extending `BaseIntegration`.
   - Validates that adapters support basic sync methods like `fetchEmployees`.

2. **Schema Field Mapping (`integrationFieldMap.model.js`)**:
   - Stores tenant-specific field overrides.
   - Translates external API attributes (such as `first_name` or `monthly_pay`) to PaySphere Employee fields.

3. **Background Job Syncing**:
   - Scheduled hourly/daily cron tasks execute sync operations automatically.
   - Uses `CronLock` to avoid race conditions when multiple app nodes run concurrent sync jobs.

## Mapping Endpoint Reference

### Get Custom Mapping
- **Endpoint**: `GET /api/integrations/:provider/mapping`
- **Response**:
  ```json
  {
    "mapping": {
      "fullName": "first_name",
      "department": "dept_id",
      "monthlySalary": "gross"
    }
  }
  ```

### Save Custom Mapping
- **Endpoint**: `PUT /api/integrations/:provider/mapping`
- **Body**:
  ```json
  {
    "mapping": {
      "fullName": "first_name",
      "department": "dept_id",
      "monthlySalary": "gross"
    }
  }
  ```
- **Response**:
  ```json
  {
    "message": "Field mapping saved successfully.",
    "mapping": {
      "fullName": "first_name",
      "department": "dept_id",
      "monthlySalary": "gross"
    }
  }
  ```
  This immediately applies to subsequent synchronization sync batches, translating remote attributes directly into our native Mongoose model structures.