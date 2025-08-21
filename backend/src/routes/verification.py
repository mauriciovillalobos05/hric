# pip install supabase
from supabase import create_client
import os

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]  # server-side
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

VERIFICATION_LEVEL_ID = os.environ["VERIFICATION_LEVEL_ID"]  # required if writing to `verifications`

def save_session(sess: VerificationSession, user_id: str):
    # Option A: write to verification_sessions (recommended for the wizard)
    payload = {
        "id": sess.id,
        "user_id": user_id,
        "actor_type": sess.actorType,
        "pii": sess.pii.model_dump(),
        "company": sess.company.model_dump(),
        "ubos": [u.model_dump() for u in sess.ubos],
        "id_verified": sess.idVerified,
        "address_verified": sess.addressVerified,
        "screening": sess.screening.model_dump(),
        "decision": sess.decision,
        "status": sess.status,
    }
    sb.table("verification_sessions").upsert(payload, on_conflict="id").execute()

def materialize_to_verifications(sess: VerificationSession, user_id: str):
    status_map = {
        "not_started": "pending",
        "in_progress": "in_progress",
        "pending_review": "under_review",
        "approved": "approved",
        "declined": "rejected",
    }
    vpayload = {
        "id": sess.id,  # optional: reuse same uuid
        "user_id": user_id,
        "verification_level_id": VERIFICATION_LEVEL_ID,
        "user_type": "investor" if sess.actorType == "individual" else "startup",
        "status": status_map.get(sess.status, "under_review"),
        "verification_data": {
            "pii": sess.pii.model_dump(),
            "company": sess.company.model_dump(),
            "ubos": [u.model_dump() for u in sess.ubos],
            "id_verified": sess.idVerified,
            "address_verified": sess.addressVerified,
        },
        "third_party_results": sess.screening.model_dump(),
    }
    sb.table("verifications").upsert(vpayload, on_conflict="id").execute()
