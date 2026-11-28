# Shopping Sul Rio: Natal

Start the sandbox with `GAME_MAPS=shopping-natal`. Join in a WebGL-capable browser and visit both atrium plinths and the upper floors. Check the seated Santa, both reindeer and their harness, the standing Santas' outfits, and the hat on the KFG mascot. Compare with a run on `GAME_MAPS=shopping`, where the cars and the regular KFG signs are visible.

Walk past the shop entrances on all three levels and look for the displays behind the storefronts and for garlands beside the logos. Look up at the canopy from the atrium and verify that the star strings meet the crossbars. Check snow below the glass on high or low graphics, then switch to performance and verify that the static decorations are still visible.

Check that the ground-floor atrium is clear of trees and that the trees upstairs and the small shop displays remain. On high graphics, watch the coloured bulbs and their glow at the atrium rails, canopy and storefronts. Switch to low and performance, then back to high, and verify that the entire strings disappear and return. Check that the glow reads at night and that signs and paths stay clear.

Capture an atrium screenshot and a storefront screenshot. Run `node --test shared/test/shopping-natal.test.ts client/test/natal-render.test.ts` for the map geometry and static mesh checks.
