// Demonstration only. No authentication, authorization, or persistent storage.
// Do not expose this server on the public Internet.
import { Server } from '@hocuspocus/server'
const port = Number(process.env.PORT || 1234)
const server = new Server({ port })
server.listen()
console.log(`Development Hocuspocus server listening on ws://localhost:${port}`)
