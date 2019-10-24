import socket, ssl
import struct
import pprint

HOST, PORT, CERT, KEY, ROOT_CA = '172.23.0.2',5063, './sippServer.pem', './sippServer.key', './myCa.pem'

def handle(conn):
  print(conn.recv())

def main():
  sock = socket.socket()
  sock.bind((HOST, PORT))
  sock.listen(5)

  context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH, cafile=ROOT_CA)
  context.verify_mode = ssl.CERT_REQUIRED
  context.load_verify_locations(cafile=ROOT_CA)
  context.load_dh_params("./dhparam.pem")
  context.load_cert_chain(certfile=CERT, keyfile=KEY)  # 1. key, 2. cert, 3. intermediates
  context.options |= ssl.OP_NO_TLSv1 | ssl.OP_NO_TLSv1_1  # optional
  context.set_ciphers('EECDH+AESGCM:EDH+AESGCM:AES256+EECDH:AES256+EDH')
  conn = None
  ssock, addr = sock.accept()
  try:
    conn = context.wrap_socket(ssock, server_side=True)
    print pprint.pformat(conn.getpeercert())
    cert = conn.getpeercert()
    conn.close()
    handle(conn)
  except ssl.SSLError as e:
    print(e)
 
  while True:
    # send and receive data from the client socket
    data_in = conn.recv(1024)
    message = data_in.decode()
    print('client send', message)

  # close the connection
  conn.shutdown(SHUT_RDWR)
  conn.close()

  # close the server socket
  ssock.shutdown(SHUT_RDWR)
  ssock.close()



if __name__ == '__main__':
  main()
