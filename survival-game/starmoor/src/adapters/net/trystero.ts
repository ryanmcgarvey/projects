// P2P transport (host-authoritative). Swapping to a real authoritative server later
// means replacing this file — the core and app protocol stay identical.
import type { Command } from '../../core'

export interface NetEvents {
  onHello(peer: string, name: string): void
  onWorld(raw: string, from: string): void
  onState(raw: string, from: string): void   // versioned serialize() payload — receiver validates
  onCmd(peer: string, cmd: Command): void
  onPeerLeave(peer: string): void
}

type Sender = (data: unknown, target?: string) => void

export class Net {
  ok = false
  selfId = `solo-${Math.random().toString(36).slice(2, 10)}`
  peers = new Set<string>()
  private sendHelloRaw: Sender = () => {}
  private sendWorldRaw: Sender = () => {}
  private sendStateRaw: Sender = () => {}
  private sendCmdRaw: Sender = () => {}

  async join(roomCode: string, ev: NetEvents): Promise<void> {
    try {
      const { joinRoom, selfId } = await import('trystero/nostr')
      const room = joinRoom({ appId: 'starmoor-proto-1' }, roomCode)
      this.selfId = selfId
      const [sendHello, getHello] = room.makeAction('hello')
      const [sendWorld, getWorld] = room.makeAction('world')
      const [sendState, getState] = room.makeAction('state')
      const [sendCmd, getCmd] = room.makeAction('cmd')
      this.sendHelloRaw = sendHello as Sender
      this.sendWorldRaw = sendWorld as Sender
      this.sendStateRaw = sendState as Sender
      this.sendCmdRaw = sendCmd as Sender

      getHello((d: unknown, peer: string) => ev.onHello(peer, String((d as { name?: unknown })?.name ?? 'Keeper')))
      getWorld((d: unknown, peer: string) => { if (typeof d === 'string') ev.onWorld(d, peer) })
      getState((d: unknown, peer: string) => { if (typeof d === 'string') ev.onState(d, peer) })
      getCmd((d: unknown, peer: string) => ev.onCmd(peer, d as Command))
      room.onPeerJoin((peer: string) => this.peers.add(peer))
      room.onPeerLeave((peer: string) => { this.peers.delete(peer); ev.onPeerLeave(peer) })
      this.ok = true
    } catch (err) {
      console.warn('[net] relays unreachable — solo harbor mode', err)
      this.ok = false
    }
  }

  hello(name: string) { if (this.ok) this.sendHelloRaw({ name }) }
  world(raw: string, target: string) { if (this.ok) this.sendWorldRaw(raw, target) }
  state(raw: string) { if (this.ok && this.peers.size > 0) this.sendStateRaw(raw) }
  cmd(c: Command) { if (this.ok) this.sendCmdRaw(c) }
}
