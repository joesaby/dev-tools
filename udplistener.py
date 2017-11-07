import socket

import argparse
parser = argparse.ArgumentParser()
parser.add_argument("port", type=int,
                    help="Post to listen on")
parser.add_argument("-v", "--verbose", action="store_true",
                    help="increase output verbosity")
args = parser.parse_args()
port = args.port

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.bind(("", port))
print "waiting on port:", port
while 1:
    data, addr = s.recvfrom(1024)
    print data, addr[0]
    s.sendto("Hello Host[{}:{}], recd your msg [{}]".format(addr[0], addr[1], data), (addr[0], addr[1]))
