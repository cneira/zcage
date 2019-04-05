 curl  -H "Content-Type: application/json" \
-d '{ "brand": "lx", "net": [ { "physical": "vnic6", "address": "192.168.1.110", "netmask": "255.255.255.0", "gateway": "192.168.1.1" } ], "ram": "4gb", "image": "898c46f3b1a1f39827ed135f020c32e2038c87ae0690a8fe73d94e5df9e6a2d6", "Cmd": ["echo", "hello World"] }' -X POST http:/192.168.1.100:8080/containers/create
# 
{"Id":"5161ac02-6b1f-e525-a0ae-edd40e471dbb","Warnings":[]}                                                                                               cneira@Trixie:~/zcage-next/tests$  curl  "http:/192.168.1.100:8080/containers/5161ac02-6b1f-e525-a0ae-edd40e471dbb/start"
{"code":"MethodNotAllowed","message":"GET is not allowed"}                                                                                                cneira@Trixie:~/zcage-next/tests$  curl -X POST  "http:/192.168.1.100:8080/containers/5161ac02-6b1f-e525-a0ae-edd40e471dbb/start"
cneira@Trixie:~/zcage-next/tests$  curl -X POST  "http:/192.168.1.100:8080/containers/5161ac02-6b1f-e525-a0ae-edd40e471dbb/wait"
{"StatusCode":0}                                                                                                                                          cneira@Trixie:~/zcage-next/tests$  curl -X POST  "http:/192.168.1.100:8080/containers/5161ac02-6b1f-e525-a0ae-edd40e471dbb/logs?stdout=true"
"hello World\n"                                                                                                
##
