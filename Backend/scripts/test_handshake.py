import socket
import struct
import sys
import os

# Configuration
GAMESERVER_HOST = os.getenv("GAMESERVER_HOST", "127.0.0.1")
GAMESERVER_PORT = int(os.getenv("GAMESERVER_PORT", "7777"))
AUTH_MAGIC = 0xCAFE1337

def encode_varint(value):
    res = bytearray()
    while True:
        byte = value & 0x7f
        value >>= 7
        if value:
            res.append(byte | 0x80)
        else:
            res.append(byte)
            break
    return res

def build_handshake(jwt, hwid="mock-hwid-123"):
    jwt_bytes = jwt.encode('utf-8')
    f1 = b'\x0a' + encode_varint(len(jwt_bytes)) + jwt_bytes
    hwid_bytes = hwid.encode('utf-8')
    f2 = b'\x12' + encode_varint(len(hwid_bytes)) + hwid_bytes
    payload = f1 + f2
    return struct.pack("<I", AUTH_MAGIC) + payload

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_handshake.py <JWT_TOKEN>")
        sys.exit(1)
        
    jwt = sys.argv[1]
    packet = build_handshake(jwt)
    print(f"Handshake packet built ({len(packet)} bytes). Sending to {GAMESERVER_HOST}:{GAMESERVER_PORT}...", flush=True)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(10.0)
    
    try:
        sock.sendto(packet, (GAMESERVER_HOST, GAMESERVER_PORT))
        print("Packet sent. Waiting for S2C_HandshakeAck...", flush=True)
        
        data, addr = sock.recvfrom(1024)
        print(f"Received {len(data)} bytes from {addr}", flush=True)
        
        magic = struct.unpack("<I", data[:4])[0]
        if magic != AUTH_MAGIC:
            print(f"Invalid magic received: {hex(magic)}", flush=True)
            sys.exit(1)
        
        print("Success! Handshake response received from GameServer.", flush=True)
        
    except socket.timeout:
        print("Timeout: No response from GameServer.", flush=True)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", flush=True)
        sys.exit(1)
    finally:
        sock.close()

if __name__ == "__main__":
    main()
