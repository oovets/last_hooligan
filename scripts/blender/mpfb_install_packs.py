# Install MakeHuman asset pack zips into MPFB's user data dir (the way MPFB's own "install asset pack" does it).
#
#   Blender -b --factory-startup --python scripts/blender/mpfb_install_packs.py -- <pack.zip> [<pack.zip> ...]
#
# --factory-startup keeps the run reproducible (no user prefs/startup file); MPFB is enabled explicitly below,
# which works because the extension lives in the user_default repo (installed with
#   Blender --command extension install-file -r user_default -e add-on-mpfb-v2.0.18.zip).
import sys, addon_utils
MOD = 'bl_ext.user_default.mpfb'
addon_utils.enable(MOD, default_set=True)   # default_set registers it in prefs.addons, which MPFB reads its prefs from
from bl_ext.user_default.mpfb.services.assetservice import AssetService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

zips = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
target = LocationService.get_user_data()
for z in zips:
    err = AssetService.check_asset_pack_zip(z)
    if err not in (None, 'STRUCTURE', 'MACOS'):
        print('PACK SKIP', z, err); continue
    err = AssetService.fix_and_extract_asset_pack_zip(z, target)
    print('PACK', 'OK' if err is None else err, z)
AssetService.rescan_pack_metadata()
AssetService.update_all_asset_lists()
print('PACKS INSTALLED', AssetService.get_pack_names())
print('SYSTEM ASSETS', AssetService.system_assets_pack_is_installed())
