# ZCAGE

----------------

# Introduction
Illumos zone manager REST API



----------------

## Get Containers

```
GET 192.168.1.100:8080/containers/json
```

List containers 

----------------

### Request

> 

### Examples:

> 

----------------

## Get vnics

```
GET 192.168.1.100:8080/vnics/json
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Networks list

```
GET 192.168.1.100:8080/networks
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Containers Images

```
GET 192.168.1.100:8080/images/json
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Create image

```
POST 192.168.1.100:8080/images/create?repo=ubuntu&tag=latest
```

List zones in host

----------------

### Request

> 
> **Query**
> 
> |Key|Value|Description|
> |---|---|---|
> |repo|ubuntu||
> |tag|latest||
> 

### Examples:

> 

----------------

## Inspect Container

```
GET 192.168.1.100:8080/containers/7c8e3fc3-aec7-6617-da36-aba985571bbe/json
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Container top

```
GET 192.168.1.100:8080/containers/01e6405c-eaa9-c020-c934-f3536a82b4ca/top
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Container wait

```
GET 192.168.1.100:8080/containers/01e6405c-eaa9-c020-c934-f3536a82b4ca/top
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Container export

```
GET 192.168.1.100:8080/containers/01e6405c-eaa9-c020-c934-f3536a82b4ca/export
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Container logs

```
GET 192.168.1.100:8080/containers/01e6405c-eaa9-c020-c934-f3536a82b4ca/logs
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Start Container

```
POST 192.168.1.100:8080/containers/afabeabe-695b-6f34-cf15-cb6276f5fb01/start
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Container prune

```
POST 192.168.1.100:8080/containers/prune
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Network vnic prune

```
POST 192.168.1.100:8080/networks/vnic/prune
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Network connect

```
POST 192.168.1.100:8080/networks/6b62037c-9eed-45af-98b0-c16c488a6a11/connect
```

List zones in host

----------------

### Request

> 
> **Header**
> 
> |Key|Value|Description|
> |---|---|---|
> |Content-Type|application/json||
> 
> **Body**
> 
> ```
> {
> 	"Container": "773ff736-da02-4207-b179-c4bf502d2e62",
>     "net": 
>         {
>             "physical": "vnic6",
>             "address": "192.168.1.110",
>             "netmask": "255.255.255.0",
>             "gateway": "192.168.1.1"
>         }
>     
> }
> ```
> 

### Examples:

> 

----------------

## Network disconnect

```
POST 192.168.1.100:8080/networks/6b62037c-9eed-45af-98b0-c16c488a6a11/disconnect
```

List zones in host

----------------

### Request

> 
> **Header**
> 
> |Key|Value|Description|
> |---|---|---|
> |Content-Type|application/json||
> 
> **Body**
> 
> ```
> {
> 	"Container": "773ff736-da02-4207-b179-c4bf502d2e62"
>     
> }
> ```
> 

### Examples:

> 

----------------

## Network create

```
POST 192.168.1.100:8080/networks/create
```

List zones in host

----------------

### Request

> 
> **Header**
> 
> |Key|Value|Description|
> |---|---|---|
> |Content-Type|application/json||
> 
> **Body**
> 
> ```
> {
>     "Name": "testing2",
>     "Config": [
>         {
>             "Subnet": "172.20.0.0/16",
>             "IPRange": "172.20.10.0/24",
>             "Gateway": "172.20.10.11",
>             "physical": "e1000g0"
>         }
>     ]
> }
> ```
> 

### Examples:

> 

----------------

## Network create vnic

```
POST 192.168.1.100:8080/network/create
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Update Container

```
POST 192.168.1.100:8080/containers/8ac475e9-7f67-62c8-86e4-b7a37bc4896d/update
```

List zones in host

----------------

### Request

> 
> **Header**
> 
> |Key|Value|Description|
> |---|---|---|
> |Content-Type|application/json||
> 
> **Body**
> 
> ```
>  {
>     "ram": "2gb",
>     "max-lwps": "3001",
>     "quota": "10G",
>     "cpu-shares": "4000"
> }
> 
> ```
> 

### Examples:

> 

----------------

## Get Container stats

```
GET 192.168.1.100:8080/containers/afabeabe-695b-6f34-cf15-cb6276f5fb01/stats
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Inspect image

```
GET 192.168.1.100:8080/images/898c46f3b1a1f39827ed135f020c32e2038c87ae0690a8fe73d94e5df9e6a2d6/json
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Stop Container

```
POST 192.168.1.100:8080/containers/afabeabe-695b-6f34-cf15-cb6276f5fb01/stop
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Delete Container

```
POST 192.168.1.100:8080/containers/afabeabe-695b-6f34-cf15-cb6276f5fb01/kill
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Restart Container

```
POST 192.168.1.100:8080/containers/afabeabe-695b-6f34-cf15-cb6276f5fb01/restart
```

List zones in host

----------------

### Request

> 

### Examples:

> 

----------------

## Create lx zone

```
POST 192.168.1.100:8080/containers/create
```

Create a zone on host 

----------------

### Request

> 
> **Header**
> 
> |Key|Value|Description|
> |---|---|---|
> |Content-Type|application/json||
> 
> **Body**
> 
> ```
> {
>     "brand": "lx",
>     "net": [
>         {
>             "physical": "vnic5",
>             "address": "192.168.1.110",
>             "netmask": "255.255.255.0",
>             "gateway": "192.168.1.1"
>         }
>     ],
>     "ram": "4gb", 
>     "image": "63d6e664-3f1f-11e8-aef6-a3120cf8dd9d"
>     
> }
> ```
> 

### Examples:

> 

----------------

## Create docker container

```
POST 192.168.1.100:8080/containers/create
```

Create a zone on host 

----------------

### Request

> 
> **Header**
> 
> |Key|Value|Description|
> |---|---|---|
> |Content-Type|application/json||
> 
> **Body**
> 
> ```
> {
>     "brand": "lx",
>     "net": [
>         {
>             "physical": "vnic6",
>             "address": "192.168.1.110",
>             "netmask": "255.255.255.0",
>             "gateway": "192.168.1.1"
>         }
>     ],
>     "ram": "4gb", 
>     "docker":  "ubuntu/latest",
>     "Cmd": ["echo", "hello world"]
>     
> }
> ```
> 

### Examples:

> 

----------------

## Create Native zone

```
POST 192.168.1.100:8080/containers/create
```

Create a zone on host 

----------------

### Request

> 
> **Header**
> 
> |Key|Value|Description|
> |---|---|---|
> |Content-Type|application/json||
> 
> **Body**
> 
> ```
> {
>     "brand": "pkgsrc",
>     "net": [
>         {
>             "physical": "vnic5",
>             "address": "192.168.1.110",
>             "netmask": "255.255.255.0",
>             "gateway": "192.168.1.1"
>         },
>         {
>         	"physical": "vnic2",
>         	"address": "dhcp"
>         }
>     ],
>     "ram": "120mb" 
>     
> }
> ```
> 

### Examples:

> 

----------------

## Create BHYVE|KVM zone

```
POST 192.168.1.100:8080/containers/create
```

Create a zone on host 

----------------

### Request

> 
> **Header**
> 
> |Key|Value|Description|
> |---|---|---|
> |Content-Type|application/json||
> 
> **Body**
> 
> ```
> {
>     "brand": "bhyve",
>     "debug": true,
>     "net": [
>         {
>             "physical": "vnic1",
>             "address": "192.168.1.209",
>             "netmask": "255.255.255.0",
>             "gateway": "192.168.1.1"
>         }
>     ],
>     "cpu": "2",
>     "with-image": "CentOS-7-x86_64-GenericCloud.qcow2.xz"
>    
> }
> ```
> 

### Examples:

> 

----------------

## Create docker using library/tag

```
POST 192.168.1.100:8080/containers/create
```

Create a zone on host 

----------------

### Request

> 
> **Header**
> 
> |Key|Value|Description|
> |---|---|---|
> |Content-Type|application/json||
> 
> **Body**
> 
> ```
> {
>     "brand": "lx",
>     "net": [
>         {
>             "physical": "vnic6",
>             "address": "192.168.1.110",
>             "netmask": "255.255.255.0",
>             "gateway": "192.168.1.1"
>         }
>     ],
>     "ram": "4gb", 
>     "docker":  "ubuntu/latest",
>     "Cmd": ["echo", "hello world"]
>     
> }
> ```
> 

### Examples:

> 

----------------

----------------
