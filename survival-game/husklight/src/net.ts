import { ActMsg, GameState, HelloMsg, PosMsg, WorldMsg } from './types'

// P2P transport. First steward in a registry hosts the authoritative sim;
// everyone else sends inputs and renders snapshots. If relays are unreachable
// (or you're alone), the game runs identically in solo-host mode.

export interface NetEvents {
  onHello(peer: string, msg: HelloMsg): void
  onWorld(msg: WorldMsg, from: string): void
  onState(state: GameState, from: string): void
  onPos(peer: string, msg: PosMsg): void
  onAct(peer: string, msg: ActMsg): void
  onPeerLeave(peer: string): void
}

type Sender = (data: unknown, target?: string) => void

export class Net {
  ok = false
  selfId = `solo-${Math.random().toString(36).slice(2, 10)}`
  peers = new Set<string>()
  private sendHello: Sender = () => {}
  private sendWorldRaw: Sender = () => {}
  private sendStateRaw: Sender = () => {}
  private sendPosRaw: Sender = () => {}
  private sendActRaw: Sender = () => {}

  async join(roomCode: string, ev: NetEvents): Promise<void> {
    try {
      const { joinRoom, selfId } = await import('trystero/nostr')
      const room = joinRoom({ appId: 'husklight-proto-1' }, roomCode)
      this.selfId = selfId
      const [sendHello, getHello] = room.makeAction('hello')
      const [sendWorld, getWorld] = room.makeAction('world')
      const [sendState, getState] = room.makeAction('state')
      const [sendPos, getPos] = room.makeAction('pos')
      const [sendAct, getAct] = room.makeAction('act')
      this.sendHello = sendHello as Sender
      this.sendWorldRaw = sendWorld as Sender
      this.sendStateRaw = sendState as Sender
      this.sendPosRaw = sendPos as Sender
      this.sendActRaw = sendAct as Sender

      getHello((d: unknown, peer: string) => ev.onHello(peer, d as HelloMsg))
      getWorld((d: unknown, peer: string) => ev.onWorld(d as WorldMsg, peer))
      getState((d: unknown, peer: string) => ev.onState(d as GameState, peer))
      getPos((d: unknown, peer: string) => ev.onPos(peer, d as PosMsg))
      getAct((d: unknown, peer: string) => ev.onAct(peer, d as ActMsg))

      room.onPeerJoin((peer: string) => { this.peers.add(peer) })
      room.onPeerLeave((peer: string) => { this.peers.delete(peer); ev.onPeerLeave(peer) })
      this.ok = true
    } catch (err) {
      console.warn('[net] relay join failed — solo mode', err)
      this.ok = false
    }
  }

  hello(msg: HelloMsg) { if (this.ok) this.sendHello(msg) }
  world(msg: WorldMsg, target: string) { if (this.ok) this.sendWorldRaw(msg, target) }
  state(s: GameState) { if (this.ok && this.peers.size > 0) this.sendStateRaw(s) }
  pos(p: PosMsg) { if (this.ok) this.sendPosRaw(p) }
  act(a: ActMsg) { if (this.ok) this.sendActRaw(a) }
}
