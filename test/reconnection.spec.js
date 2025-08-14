import {test, expect} from '@playwright/test';
import chalk from 'chalk';

const testUrl = 'https://localhost:8080/test';
const strategy = 'torrent';

const onConsole = (strategy, browser, pageN) => msg =>
  console.log(`${strategy} ${browser}${pageN}:`, msg)

test('reconnection bug', async ({ page, browser, browserName }) => {
  test.setTimeout(60000);

  const roomConfig = {
    appId: `trystero-reconnection-test-${Math.random()}`,
    password: 'password-' + Math.random(),
  };

  const scriptUrl = `../dist/trystero-${strategy}.min.js`;
  const context = await browser.newContext();
  const page2 = await context.newPage();

  page.on('console', onConsole(strategy, browserName, 1));
  page2.on('console', onConsole(strategy, browserName, 2));
  page.on('pageerror', err => console.log('page1 error', err));
  page2.on('pageerror', err => console.log('page2 error', err));

  await page.goto(testUrl);
  await page2.goto(testUrl);

  const loadLib = async path => (window.trystero = await import(path));

  await page.evaluate(loadLib, scriptUrl);
  await page2.evaluate(loadLib, scriptUrl);

  const roomNs = `test-room-${Math.random()}`;

  const joinRoom = ([config, roomNs]) => {
    const room = window.trystero.joinRoom(config, roomNs);
    window.room = room;
    return new Promise(res => room.onPeerJoin(res));
  };

  const [peer2Id] = await Promise.all([
    page.evaluate(joinRoom, [roomConfig, roomNs]),
    page2.evaluate(joinRoom, [roomConfig, roomNs])
  ]);

  const getSelfId = () => window.trystero.selfId;
  const peer1Id = await page.evaluate(getSelfId);

  const listenForLeave = () => new Promise(res => window.room.onPeerLeave(res));
  const leaveRoom = () => window.room.leave();

  const [peer1Left] = await Promise.all([
    page2.evaluate(listenForLeave),
    page.evaluate(leaveRoom)
  ]);
  expect(peer1Left).toBe(peer1Id);

  const rejoinRoom = ([config, roomNs]) => {
    const room = window.trystero.joinRoom(config, roomNs);
    window.room = room;
    return new Promise(res => room.onPeerJoin(res));
  };

  const listenForJoin = () => new Promise(res => window.room.onPeerJoin(res));

  const [rejoinedPeerIdOnPage2] = await Promise.all([
    page2.evaluate(listenForJoin),
    page.evaluate(rejoinRoom, [roomConfig, roomNs])
  ]);

  const newPeer1Id = await page.evaluate(getSelfId);
  expect(rejoinedPeerIdOnPage2).toBe(newPeer1Id);
});
