# Shopping Sul Rio promotions and recycling

Open the Shopping Sul Rio scenario explorer in a WebGL-capable browser. Check the easels beside selected ground-floor and Mirante doors. Check the recycling cabinets behind the atrium kiosk, by food court seating and along the Mirante gallery. In **andar** mode, walk into each cabinet to confirm it blocks movement, then walk around it. Capture the labels, handles and two openings up close.

In a Shopping Sul Rio match, capture a ground-floor shop and a Mirante shop with active Black Friday ribbons. Compare the storefronts across a three-minute server slot boundary and check that their logos and doorways stay clear. Switch to **desempenho** and check the active ribbons and printed labels remain visible. Repeat on Natal where ribbons and garlands share the storefronts.

Run `node --test shared/test/sale.test.ts shared/test/recycle-bins.test.ts client/test/mall-scenery.test.ts client/test/benchmark.test.ts` to check placements, the server-time rotation and the benchmark walking corridor.
