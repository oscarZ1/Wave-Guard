-- FICTIONAL seed data. These people, emails and phone numbers are invented for the demo.
-- Do not replace with the real Pepperdine directory.
INSERT INTO directory (name, title, department, official_emails, verify_channel) VALUES
  ('Alex Rivera',       'Dean of Students',                   'Student Affairs',          ARRAY['alex.rivera@pepperdine.edu', 'deanofstudents@pepperdine.edu'], 'Office line (310) 555-0142'),
  ('Jordan Kim',        'Provost',                            'Office of the Provost',    ARRAY['jordan.kim@pepperdine.edu', 'provost@pepperdine.edu'],          'Office line (310) 555-0118'),
  ('Priya Natarajan',   'Chief Information Security Officer', 'Information Technology',   ARRAY['priya.natarajan@pepperdine.edu'],                                'Teams chat or (310) 555-0190'),
  ('IT Security',       'Information Security Office',        'Information Technology',   ARRAY['security@pepperdine.edu'],                                       'Help desk (310) 555-0100'),
  ('IT Help Desk',      'Technology Support',                 'Information Technology',   ARRAY['helpdesk@pepperdine.edu', 'it-support@pepperdine.edu'],          'Walk-in at the Tech Central desk'),
  ('Marcus Bell',       'Director of Financial Aid',          'Financial Aid',            ARRAY['marcus.bell@pepperdine.edu', 'finaid@pepperdine.edu'],           'Office line (310) 555-0131'),
  ('Elena Vasquez',     'University Registrar',               'Office of the Registrar',  ARRAY['elena.vasquez@pepperdine.edu', 'registrar@pepperdine.edu'],      'Office line (310) 555-0125'),
  ('Samuel Okafor',     'Professor of Computer Science',      'Seaver College',           ARRAY['samuel.okafor@pepperdine.edu'],                                  'Office hours, Rockwell 214'),
  ('Payson Library',    'Library Services',                   'University Libraries',     ARRAY['library@pepperdine.edu'],                                        'Circulation desk (310) 555-0170');

-- Domains the campus uses (illustrative list for the demo).
INSERT INTO known_domains (domain, owner, purpose) VALUES
  ('pepperdine.edu',      'Pepperdine University',  'Primary campus domain'),
  ('pepperdinewaves.com', 'Pepperdine Athletics',   'Athletics website'),
  ('okta.com',            'Okta',                   'Single sign-on provider'),
  ('instructure.com',     'Instructure Canvas',     'Learning management system'),
  ('zoom.us',             'Zoom',                   'Video meetings'),
  ('google.com',          'Google Workspace',       'Email, Drive and Docs'),
  ('microsoft.com',       'Microsoft 365',          'Office apps'),
  ('office.com',          'Microsoft 365',          'Office apps');
