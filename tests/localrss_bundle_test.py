"""Tests for the bundle preflight; no dependency installs, database or network."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('localrss_bundle', 'localrss_bundle.py')
bundle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundle)


class BundleCheckTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        backend = self.root / 'localrss_bundled'
        backend.mkdir()
        (backend / 'app.py').write_text('raise RuntimeError("Must not execute backend")', encoding='utf-8')
        (backend / 'feeds.opml').write_text('<opml/>', encoding='utf-8')

    def test_checks_actual_dependency_imports_without_starting_backend(self):
        with patch.object(bundle.importlib, 'import_module') as load:
            bundle.check_localrss_bundle(self.root)
        self.assertEqual([c.args[0] for c in load.call_args_list], list(bundle.DEPENDENCIES))
        self.assertIn('aiohttp', bundle.DEPENDENCIES)

    def test_missing_dependency_fails_the_build_check(self):
        with patch.object(bundle.importlib, 'import_module', side_effect=ModuleNotFoundError('aiohttp')):
            with self.assertRaises(ModuleNotFoundError): bundle.check_localrss_bundle(self.root)

    def test_missing_bundle_asset_fails_the_build_check(self):
        (self.root / 'localrss_bundled' / 'feeds.opml').unlink()
        with self.assertRaisesRegex(RuntimeError, 'feeds.opml'): bundle.check_localrss_bundle(self.root)


if __name__ == '__main__': unittest.main()
