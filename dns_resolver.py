import dns.resolver

def resolve_a_record_or_cname(address):
    result = ""
    try:
        answers = dns.resolver.query(address)
        for data in answers:
            # print "Queried address [{}], Obtained result [{}]".format(address, data.address)
            result = result + str(data.address) if result == "" else result + " , " + str(data.address)
    except Exception as e:
        pass
    return result

def resolve_srv_record(address):
    result = ""
    try:
        answers = dns.resolver.query(address, 'SRV')
        for data in answers:
            cname_address = data.target
            answer = resolve_a_record_or_cname(cname_address)
            # print "Queried address [{}], Obtained CNAME [{}]".format(address, cname_address)
            result = result + answer if result == "" else result + " , " + answer
    except Exception as ex:
        pass
    return result
