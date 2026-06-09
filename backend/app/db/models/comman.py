"""
Auth & Organisation domain.

Tables
------
users          — every human on the platform (admin, employer staff, candidate)
organizations  — a verified company / employer tenant
org_members    — many-to-many: which users belong to which org and at what role
"""

"""
Candidate domain.

Tables
------
candidate_profiles  — one per candidate user; holds subscription state and
                      a pointer to their current active resume version.
resume_versions     — immutable snapshots of a resume. Every upload creates a
                      new version; the application locks the version used at
                      submission time so employers always see what was matched.
"""

