# Lab 4 Steering Log: Failure-Loop Log & Refactoring

### Incident 1: Incorrect Reservation Listing Requirement

- **Initial Agent Output:** The agent initially kept the status filter, excluding cancelled reservations based on the older Lab 2 requirement. During testing, it also flagged returning all statuses as a contract mismatch, even though Lab 4 requires listing all bookings.

- **Root Cause:** The agent followed the older Lab 2 specification and the outdated OpenAPI description instead of prioritizing the current Lab 4 requirement.

- **Remediation Prompt:** The actual correction sent to the agent was: "this api should list all related reservations of a user, but current logic is filter the reservations where status==active."

- **Resolution:** The agent removed the status filter and updated the OpenAPI description. The endpoint now returns reservations of any status (`PENDING`, `CONFIRMED`, or `CANCELLED`) for the specified user. An integration test confirmed that all three statuses were returned, while another user's booking was excluded.