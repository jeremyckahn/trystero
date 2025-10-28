# Reconnection Bug and Fix

This document details a bug related to peer reconnection and the fix that was implemented to resolve it.

## The Original Issue

A bug was identified where peer reconnections would not work consistently, particularly when using the 'torrent' signaling strategy. When a peer left a room and then attempted to rejoin, other peers in the room would often not be notified of the rejoining peer. This resulted in an inconsistent state where the rejoining peer might be able to connect to others, but not vice-versa.

The issue was intermittent, making it difficult to reproduce consistently.

## Root Cause Analysis

The root cause of the bug was traced to the way the client interacted with the WebTorrent tracker. When a peer left a room, the client would stop sending 'announce' messages, but it would not explicitly notify the tracker that it was leaving the swarm.

According to the WebTorrent tracker protocol, a client should send an 'announce' request with an `event=stopped` parameter when it gracefully leaves. Without this notification, the tracker would keep the peer in its list of active peers for a period of time. When the same peer tried to reconnect, the tracker would have stale information, leading to the observed reconnection issues.

## The Fix

The fix was implemented in `src/torrent.js`. The `subscribe` function, which is responsible for managing the connection to the tracker, was modified to send a `stopped` event when a peer leaves the room.

Specifically, the following changes were made:
1.  The `send` function was updated to accept an optional `event` parameter, which is then included in the payload sent to the tracker.
2.  The cleanup function returned by `subscribe` was modified to call `send` with `event: 'stopped'`.

This ensures that the tracker is always notified when a peer leaves, allowing it to maintain an accurate list of active peers and preventing reconnection conflicts.

## Verification

To verify the fix, a new Playwright test was created in `test/reconnection.spec.js`. This test simulates the exact scenario described in the bug report:
1.  Two peers join a room.
2.  One peer leaves.
3.  The same peer rejoins the room.
4.  The test asserts that the other peer is correctly notified of the rejoin.

Without the fix, this test would intermittently fail by timing out, as the `onPeerJoin` event would not be fired. With the fix in place, the test passes consistently, confirming that the bug has been resolved.
