from django.db import migrations

SQL = r"""
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'isoko_app') THEN
    CREATE ROLE isoko_app NOLOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO isoko_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO isoko_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO isoko_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO isoko_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO isoko_app;

CREATE OR REPLACE FUNCTION isoko_tenant_match(bid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT bid IS NOT NULL AND (
    bid::text = ANY (
      string_to_array(coalesce(nullif(current_setting('isoko.business_ids', true), ''), ''), ',')
    )
    OR bid::text = coalesce(current_setting('isoko.write_business', true), '')
  );
$$;

CREATE OR REPLACE FUNCTION isoko_person_match(applicant uuid, email text, token text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    (applicant IS NOT NULL AND applicant::text = coalesce(current_setting('isoko.user_id', true), ''))
    OR (
      coalesce(email, '') <> ''
      AND lower(email) = lower(coalesce(current_setting('isoko.user_email', true), ''))
    )
    OR (
      coalesce(token, '') <> ''
      AND token = coalesce(current_setting('isoko.dossier_token', true), '')
    );
$$;

GRANT EXECUTE ON FUNCTION isoko_tenant_match(uuid) TO isoko_app;
GRANT EXECUTE ON FUNCTION isoko_person_match(uuid, text, text) TO isoko_app;

ALTER TABLE education_educationprofile ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_educationunit ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_educationprogram ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_admissioncampaign ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_enrollmentapplication ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_enrollmentdocument ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_enrollmentevent ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_educationfee ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_educationfeepayment ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_schoolplanseat ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_schoolcriterion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS education_profile_read ON education_educationprofile;
CREATE POLICY education_profile_read ON education_educationprofile
  FOR SELECT USING (
    isoko_tenant_match(business_id) OR publication_status = 'PUBLISHED'
  );
DROP POLICY IF EXISTS education_profile_write ON education_educationprofile;
CREATE POLICY education_profile_write ON education_educationprofile
  FOR ALL USING (isoko_tenant_match(business_id))
  WITH CHECK (isoko_tenant_match(business_id));

DROP POLICY IF EXISTS education_unit_read ON education_educationunit;
CREATE POLICY education_unit_read ON education_educationunit
  FOR SELECT USING (
    isoko_tenant_match(business_id)
    OR EXISTS (
      SELECT 1 FROM education_educationprofile p
      WHERE p.business_id = education_educationunit.business_id
        AND p.publication_status = 'PUBLISHED'
    )
  );
DROP POLICY IF EXISTS education_unit_write ON education_educationunit;
CREATE POLICY education_unit_write ON education_educationunit
  FOR ALL USING (isoko_tenant_match(business_id))
  WITH CHECK (isoko_tenant_match(business_id));

DROP POLICY IF EXISTS education_program_read ON education_educationprogram;
CREATE POLICY education_program_read ON education_educationprogram
  FOR SELECT USING (
    isoko_tenant_match(business_id)
    OR (
      is_public AND EXISTS (
        SELECT 1 FROM education_educationprofile p
        WHERE p.business_id = education_educationprogram.business_id
          AND p.publication_status = 'PUBLISHED'
      )
    )
  );
DROP POLICY IF EXISTS education_program_write ON education_educationprogram;
CREATE POLICY education_program_write ON education_educationprogram
  FOR ALL USING (isoko_tenant_match(business_id))
  WITH CHECK (isoko_tenant_match(business_id));

DROP POLICY IF EXISTS education_campaign_read ON education_admissioncampaign;
CREATE POLICY education_campaign_read ON education_admissioncampaign
  FOR SELECT USING (
    isoko_tenant_match(business_id)
    OR (
      is_public AND EXISTS (
        SELECT 1 FROM education_educationprofile p
        WHERE p.business_id = education_admissioncampaign.business_id
          AND p.publication_status = 'PUBLISHED'
      )
    )
    OR EXISTS (
      SELECT 1 FROM education_enrollmentapplication a
      WHERE a.campaign_id = education_admissioncampaign.id
        AND isoko_person_match(a.applicant_id, a.student_email, a.access_token)
    )
  );
DROP POLICY IF EXISTS education_campaign_write ON education_admissioncampaign;
CREATE POLICY education_campaign_write ON education_admissioncampaign
  FOR ALL USING (isoko_tenant_match(business_id))
  WITH CHECK (isoko_tenant_match(business_id));

DROP POLICY IF EXISTS education_application_read ON education_enrollmentapplication;
CREATE POLICY education_application_read ON education_enrollmentapplication
  FOR SELECT USING (
    isoko_tenant_match(business_id)
    OR isoko_person_match(applicant_id, student_email, access_token)
    OR EXISTS (
      SELECT 1 FROM education_educationfeepayment pay
      WHERE pay.application_id = education_enrollmentapplication.id
        AND coalesce(pay.payment_token, '') <> ''
        AND pay.payment_token = coalesce(current_setting('isoko.payment_token', true), '')
    )
  );
DROP POLICY IF EXISTS education_application_write ON education_enrollmentapplication;
CREATE POLICY education_application_write ON education_enrollmentapplication
  FOR ALL USING (isoko_tenant_match(business_id))
  WITH CHECK (isoko_tenant_match(business_id));

DROP POLICY IF EXISTS education_document_all ON education_enrollmentdocument;
CREATE POLICY education_document_all ON education_enrollmentdocument
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM education_enrollmentapplication a
      WHERE a.id = education_enrollmentdocument.application_id
        AND (
          isoko_tenant_match(a.business_id)
          OR isoko_person_match(a.applicant_id, a.student_email, a.access_token)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM education_enrollmentapplication a
      WHERE a.id = education_enrollmentdocument.application_id
        AND (
          isoko_tenant_match(a.business_id)
          OR isoko_person_match(a.applicant_id, a.student_email, a.access_token)
        )
    )
  );

DROP POLICY IF EXISTS education_event_all ON education_enrollmentevent;
CREATE POLICY education_event_all ON education_enrollmentevent
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM education_enrollmentapplication a
      WHERE a.id = education_enrollmentevent.application_id
        AND (
          isoko_tenant_match(a.business_id)
          OR isoko_person_match(a.applicant_id, a.student_email, a.access_token)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM education_enrollmentapplication a
      WHERE a.id = education_enrollmentevent.application_id
        AND (
          isoko_tenant_match(a.business_id)
          OR isoko_person_match(a.applicant_id, a.student_email, a.access_token)
        )
    )
  );

DROP POLICY IF EXISTS education_fee_read ON education_educationfee;
CREATE POLICY education_fee_read ON education_educationfee
  FOR SELECT USING (
    isoko_tenant_match(business_id)
    OR (
      is_public AND EXISTS (
        SELECT 1 FROM education_educationprofile p
        WHERE p.business_id = education_educationfee.business_id
          AND p.publication_status = 'PUBLISHED'
      )
    )
  );
DROP POLICY IF EXISTS education_fee_write ON education_educationfee;
CREATE POLICY education_fee_write ON education_educationfee
  FOR ALL USING (isoko_tenant_match(business_id))
  WITH CHECK (isoko_tenant_match(business_id));

DROP POLICY IF EXISTS education_payment_all ON education_educationfeepayment;
CREATE POLICY education_payment_all ON education_educationfeepayment
  FOR ALL USING (
    (
      coalesce(payment_token, '') <> ''
      AND payment_token = coalesce(current_setting('isoko.payment_token', true), '')
    )
    OR (
      applicant_id IS NOT NULL
      AND applicant_id::text = coalesce(current_setting('isoko.user_id', true), '')
    )
    OR EXISTS (
      SELECT 1 FROM education_educationfee f
      WHERE f.id = education_educationfeepayment.fee_id
        AND isoko_tenant_match(f.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM education_educationfee f
      WHERE f.id = education_educationfeepayment.fee_id
        AND isoko_tenant_match(f.business_id)
    )
    OR (
      applicant_id IS NOT NULL
      AND applicant_id::text = coalesce(current_setting('isoko.user_id', true), '')
    )
  );

DROP POLICY IF EXISTS education_seat_all ON education_schoolplanseat;
CREATE POLICY education_seat_all ON education_schoolplanseat
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM education_admissioncampaign c
      WHERE c.id = education_schoolplanseat.campaign_id
        AND isoko_tenant_match(c.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM education_admissioncampaign c
      WHERE c.id = education_schoolplanseat.campaign_id
        AND isoko_tenant_match(c.business_id)
    )
  );

DROP POLICY IF EXISTS education_criterion_all ON education_schoolcriterion;
CREATE POLICY education_criterion_all ON education_schoolcriterion
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM education_admissioncampaign c
      WHERE c.id = education_schoolcriterion.campaign_id
        AND isoko_tenant_match(c.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM education_admissioncampaign c
      WHERE c.id = education_schoolcriterion.campaign_id
        AND isoko_tenant_match(c.business_id)
    )
  );
"""


def enable_rls(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute(SQL)


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0029_encrypt_dossier_fields'),
    ]

    operations = [
        migrations.RunPython(enable_rls, migrations.RunPython.noop),
    ]
