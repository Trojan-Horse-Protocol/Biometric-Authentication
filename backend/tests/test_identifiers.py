import unittest

from backend.app.identifiers import is_valid_identifier, normalize_identifier


class IdentifierValidationTests(unittest.TestCase):
    def test_accepts_valid_usernames_and_emails(self):
        self.assertTrue(is_valid_identifier("alex_7"))
        self.assertTrue(is_valid_identifier("alex.smith+passkey@example.com"))

    def test_rejects_malformed_identifiers(self):
        for identifier in ("ab", "not an email", "alex@", "@example.com", "a..b@example.com"):
            with self.subTest(identifier=identifier):
                self.assertFalse(is_valid_identifier(identifier))

    def test_normalizes_email_case_and_surrounding_whitespace(self):
        self.assertEqual(normalize_identifier("  Alex@Example.com  "), "alex@example.com")

    def test_preserves_username_case(self):
        self.assertEqual(normalize_identifier("  Alex_7  "), "Alex_7")


if __name__ == "__main__":
    unittest.main()
