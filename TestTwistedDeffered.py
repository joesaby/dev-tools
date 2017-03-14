from twisted.internet import defer
from twisted.internet.defer import Deferred

def got_poem(res):
    print 'got_poem : Your poem is served:'
    return "prepared by got_poem {}".format(res)

d1 = Deferred()
d2 = Deferred()

d = defer.DeferredList([d1, d2])

d1.callback(got_poem('D1 callback.'))
d2.callback('D2 callback.')


@d.addCallback
def printSuccess(msg):
    print "printSuccess : Inside"
    for m in msg:
    	print "Type m = {} |  data = {}".format(type(m), m)


# fire the chain with a normal result
#d.callback('This poem is short.')
#d.callback(printSuccess)

print "Finished"
