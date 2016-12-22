'''
    udp socket client
    Silver Moon
'''
 
import socket   #for sockets
import sys  #for exit
import argparse
parser = argparse.ArgumentParser()

parser.add_argument("host", help="Host to connect to")
parser.add_argument("port", type=int,
                    help="Port to connect to")

parser.add_argument("-v", "--verbose", action="store_true",
                    help="increase output verbosity")
args = parser.parse_args()

host = args.host
port = args.port

print "host:"+host+" | port:"+str(port)

# create dgram udp socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
except socket.error:
    print 'Failed to create socket'
    sys.exit()

 
while(1) :
    msg = raw_input('Enter message to send : ')
     
    try :
        #Set the whole string
        s.sendto(msg, (host, port))
         
        # receive data from client (data, addr)
        d = s.recvfrom(1024)
        reply = d[0]
        addr = d[1]
         
        print 'Server reply : ' + reply
     
    except socket.error, msg:
        print 'Error Code : ' + str(msg[0]) + ' Message ' + msg[1]
        sys.exit()


