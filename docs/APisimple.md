{
  "openapi": "3.0.2",
  "info": {
    "title": "Simplemining.net API",
    "version": "latest",
    "x-logo": {
      "url": "/logo.png"
    },
    "description": "# REST API\n\n## Overview\n\nThe API is based on REST principles. It supports GET, POST, PUT, PATCH and DELETE requests.\n\n## Base URI\n\nAll URLs referenced in the documentation have the following base:\nhttps://api.simplemining.net\n\n## Authentication\n\n<SecurityDefinitions />\n"
  },
  "servers": [
    {
      "url": "https://api.simplemining.net"
    }
  ],
  "components": {
    "schemas": {
      "error": {
        "$ref": "#/components/schemas/Error"
      },
      "Error": {
        "type": "object",
        "properties": {
          "type": {
            "description": "Type of error",
            "type": "string",
            "x-nullable": false,
            "example": "https://tools.ietf.org/html/rfc2616#section-10"
          },
          "title": {
            "description": "Error title",
            "type": "string",
            "x-nullable": false,
            "example": "An error occurred"
          },
          "detail": {
            "description": "Error description",
            "type": "string",
            "x-nullable": false
          }
        }
      }
    },
    "responses": {
      "400": {
        "description": "Bad Request",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      },
      "401": {
        "description": "Unauthorized",
        "content": {
          "application/json": {
            "schema": {
              "allOf": [
                {
                  "$ref": "#/components/schemas/Error"
                },
                {
                  "properties": {
                    "detail": {
                      "example": "Invalid credentials."
                    }
                  }
                }
              ]
            }
          }
        }
      },
      "403": {
        "description": "Forbidden",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      },
      "404": {
        "description": "Not Found",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      },
      "422": {
        "description": "Unprocessable Entity",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      },
      "423": {
        "description": "Locked",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      }
    },
    "securitySchemes": {
      "apiKey": {
        "type": "apiKey",
        "in": "header",
        "name": "X-AUTH-TOKEN",
        "description": "To call api methods you must provide api key.<br /> The api key is listed in Account Settings on Subaccouts tab.<br /> Each api key is assigned to subaccount and its permissions."
      }
    }
  },
  "security": [
    {
      "apiKey": [api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8]
    }
  ],
  "paths": {
    "/deposits/address": {
      "get": {
        "tags": [
          "Deposit Fee"
        ],
        "summary": "Get deposit address",
        "description": "Get deposit address by currency code",
        "operationId": "addressDepositCollection",
        "parameters": [
          {
            "name": "currency",
            "in": "query",
            "description": "Currency code",
            "required": true,
            "example": "ETH",
            "schema": {
              "type": "string",
              "enum": [
                "BTC",
                "ETH",
                "ETC",
                "ZEC",
                "LTC"
              ]
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "currency": {
                      "description": "Currency code",
                      "type": "string",
                      "x-nullable": false,
                      "enum": [
                        "BTC",
                        "ETH",
                        "ETC",
                        "ZEC",
                        "LTC"
                      ],
                      "example": "ETH"
                    },
                    "currencyStatus": {
                      "description": "Currency status",
                      "type": "string",
                      "x-nullable": false,
                      "example": "online"
                    },
                    "address": {
                      "description": "Currency address",
                      "type": "string",
                      "x-nullable": false,
                      "example": "0x734272hdhduahdufu38748er7wDC"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "Currency not found."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Deposit Fee."
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/deposits/address?currency=eth' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$params = ['currency' => 'eth'];\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/deposits/address?' . http_build_query($params),\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/deposits/summary": {
      "get": {
        "tags": [
          "Deposit Fee"
        ],
        "summary": "Get deposit summary",
        "description": "Get deposit summary including balance, service days remaining, etc",
        "operationId": "summaryDepositCollection",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "balanceMining": {
                      "description": "User balance",
                      "type": "string",
                      "x-nullable": false,
                      "example": "20.002"
                    },
                    "daysRemaining": {
                      "description": "Service remaining in days",
                      "type": "float",
                      "x-nullable": false,
                      "example": 10
                    },
                    "isAccountBlocked": {
                      "description": "Indicates if account is blocked or not",
                      "type": "bool",
                      "x-nullable": false,
                      "example": false
                    },
                    "rates": {
                      "description": "Current coin rates",
                      "type": "object",
                      "x-nullable": false,
                      "example": {
                        "BTC": "36458.91",
                        "ZEC": "126.91",
                        "ETH": "2747.66",
                        "LTC": "97.43"
                      }
                    },
                    "last24hRigsCount": {
                      "description": "User rigs online in last 24 hours",
                      "type": "integer",
                      "x-nullable": false,
                      "example": 2
                    },
                    "discountLevel": {
                      "description": "Discount level",
                      "type": "integer",
                      "x-nullable": false,
                      "example": 0
                    },
                    "discountLevelRate": {
                      "description": "Discount level rate",
                      "type": "integer",
                      "x-nullable": false,
                      "example": 1
                    },
                    "currentPricePerRig": {
                      "description": "Current price per rig",
                      "type": "float",
                      "x-nullable": false,
                      "example": 2
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Deposit Fee."
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/deposits/summary' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/deposits/summary',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/deposits/user-list": {
      "get": {
        "tags": [
          "Deposit Fee"
        ],
        "summary": "Get deposit list",
        "description": "Get deposit list with transaction ID, status, etc",
        "operationId": "userListDepositCollection",
        "parameters": [
          {
            "name": "itemsPerPage",
            "in": "query",
            "description": "Number of items returned",
            "example": 100,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "page",
            "in": "query",
            "description": "Number of page",
            "example": 1,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "order[createdAt]",
            "in": "query",
            "description": "Order by createdAt",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[amountUsd]",
            "in": "query",
            "description": "Order by amountUsd",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[status]",
            "in": "query",
            "description": "Order by status",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "properties": {
                      "id": {
                        "description": "ID",
                        "type": "integer",
                        "x-nullable": false,
                        "example": 1
                      },
                      "txnId": {
                        "description": "Transaction ID",
                        "type": "string",
                        "x-nullable": false
                      },
                      "txnLink": {
                        "description": "Transaction link",
                        "type": "string",
                        "x-nullable": false,
                        "example": "https://blockchair.com/litecoin/transaction/{txnId}"
                      },
                      "addressLink": {
                        "description": "Address link",
                        "type": "string",
                        "x-nullable": false,
                        "example": "https://blockchair.com/litecoin/address/{address}"
                      },
                      "currency": {
                        "description": "Currency code",
                        "type": "string",
                        "x-nullable": false,
                        "example": "LTC"
                      },
                      "amount": {
                        "description": "Amount in currency",
                        "type": "string",
                        "x-nullable": false,
                        "example": "0.00062084"
                      },
                      "amountUsd": {
                        "description": "Amount in $",
                        "type": "string",
                        "x-nullable": false,
                        "example": "0.0503"
                      },
                      "status": {
                        "description": "Transaction status",
                        "type": "integer",
                        "x-nullable": false,
                        "example": 100
                      },
                      "createdAt": {
                        "description": "Created date",
                        "type": "date",
                        "x-nullable": false,
                        "example": "2022-01-13T21:25:45+01:00"
                      },
                      "finishedAt": {
                        "description": "Finished date",
                        "type": "date",
                        "x-nullable": false,
                        "example": "2022-01-13T21:25:45+01:00"
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Deposit Fee."
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/deposits/user-list' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/deposits/user-list',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/user-list": {
      "get": {
        "tags": [
          "Rig List"
        ],
        "summary": "Get Rig List",
        "description": "Get Rig List for User",
        "operationId": "getRigUserListCollection",
        "parameters": [
          {
            "name": "itemsPerPage",
            "in": "query",
            "description": "Number of items returned",
            "example": 100,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "page",
            "in": "query",
            "description": "Number of page",
            "example": 1,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "order[name]",
            "in": "query",
            "description": "Order by name",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[hashrate]",
            "in": "query",
            "description": "Order by hashrate",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[status]",
            "in": "query",
            "description": "Order by status",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[temp]",
            "in": "query",
            "description": "Order by max temperature",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[rigOc.name]",
            "in": "query",
            "description": "Order by Group OC name",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[description]",
            "in": "query",
            "description": "Order by info",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[startCount]",
            "in": "query",
            "description": "Order by number of restarts",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[sysPwr]",
            "in": "query",
            "description": "Order by power consumption (watts)",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "statusAlert",
            "in": "query",
            "description": "Filter by alerts: <br /> has_alerts - With alerts <br /> no_alerts - Without alerts <br /> reboot - Only Reboots <br /> gpu - Only Missing GPU <br /> paused - Only Paused <br /> temp - Only Temp",
            "example": "has_alerts",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "has_alerts",
                "no_alerts",
                "reboot",
                "gpu",
                "paused",
                "temp"
              ]
            }
          },
          {
            "name": "status",
            "in": "query",
            "description": "Filter by status",
            "example": "on",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "on",
                "off"
              ]
            }
          },
          {
            "name": "statusAddedTimeDelay",
            "in": "query",
            "description": "Filter by rig added within (value in seconds)",
            "example": 3600,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "statusTimeDelay",
            "in": "query",
            "description": "Filter by status OFF within (value in seconds)",
            "example": 3600,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "statusTimeGreaterThan",
            "in": "query",
            "description": "Filter by status OFF more than (value in seconds)",
            "example": 3600,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "osSeries",
            "in": "query",
            "description": "Filter by osSeries <br /> see: <a href=\"#tag/Rig/operation/getFilterListRigCollection\">Get filter List</a>",
            "example": "NV",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "rigGroup",
            "in": "query",
            "description": "Filter by Group Config ID <br /> see: <a href=\"#tag/Rig/operation/getFilterListRigCollection\">Get filter List</a>",
            "example": 1,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "rigOc",
            "in": "query",
            "description": "Filter by Group OC ID <br /> see: <a href=\"#tag/Rig/operation/getFilterListRigCollection\">Get filter List</a>",
            "example": 1,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "userTags[]",
            "in": "query",
            "description": "Filter by Tags <br /> see: <a href=\"#tag/Rig/operation/getFilterListRigCollection\">Get filter List</a>",
            "example": 1,
            "required": false,
            "schema": {
              "type": "array",
              "items": {
                "type": "integer"
              }
            }
          },
          {
            "name": "search",
            "in": "query",
            "description": "Filter by name, description, OS Series, OS Version, Group Config name, Group OC name, Support ID",
            "required": false,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "properties": {
                      "id": {
                        "type": "integer"
                      },
                      "name": {
                        "type": "string"
                      },
                      "description": {
                        "type": "string"
                      },
                      "startCount": {
                        "description": "Number of restarts",
                        "type": "integer",
                        "example": 0
                      },
                      "ip": {
                        "type": "string"
                      },
                      "gpuCountMax": {
                        "type": "integer"
                      },
                      "executeStatus": {
                        "type": "string"
                      },
                      "osSeries": {
                        "type": "string"
                      },
                      "osVersion": {
                        "type": "string"
                      },
                      "ocCore": {
                        "type": "string"
                      },
                      "ocMemory": {
                        "type": "string"
                      },
                      "ocPowerLimit": {
                        "type": "string"
                      },
                      "ocVddc": {
                        "type": "string"
                      },
                      "ocMode": {
                        "type": "boolean"
                      },
                      "ocTempTarget": {
                        "type": "string"
                      },
                      "ocFanSpeedMin": {
                        "type": "string"
                      },
                      "ocAdvTools": {
                        "type": "string"
                      },
                      "ocMvdd": {
                        "type": "string"
                      },
                      "ocMvddci": {
                        "type": "string"
                      },
                      "dateResetCounter": {
                        "type": "date",
                        "example": "2022-05-10T13:59:01+02:00"
                      },
                      "date": {
                        "type": "date",
                        "example": "2022-03-16T11:47:34+01:00"
                      },
                      "dateStart": {
                        "type": "date",
                        "example": "2022-03-10T09:27:30+01:00"
                      },
                      "isPaused": {
                        "type": "boolean"
                      },
                      "isOcAdvToolsOn": {
                        "type": "boolean"
                      },
                      "isOcDelayed": {
                        "type": "boolean"
                      },
                      "isOnline": {
                        "type": "boolean"
                      },
                      "user": {
                        "type": "object",
                        "properties": {
                          "alertRestartLimit": {
                            "type": "integer",
                            "example": 15
                          }
                        }
                      },
                      "rigGroup": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "integer",
                            "example": 1
                          },
                          "name": {
                            "type": "string"
                          },
                          "minerProgram": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "integer",
                                "example": 1
                              },
                              "name": {
                                "type": "string",
                                "example": "teamredminer-v0.9.4.1"
                              }
                            }
                          }
                        }
                      },
                      "rigOc": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "integer",
                            "example": 1
                          },
                          "name": {
                            "type": "string"
                          },
                          "osSeries": {
                            "type": "string",
                            "example": "RX"
                          },
                          "ocCore": {
                            "type": "string"
                          },
                          "ocMemory": {
                            "type": "string"
                          },
                          "ocPowerLimit": {
                            "type": "string"
                          },
                          "ocVddc": {
                            "type": "string"
                          },
                          "ocMode": {
                            "type": "boolean"
                          },
                          "ocTempTarget": {
                            "type": "string"
                          },
                          "ocFanSpeedMin": {
                            "type": "string"
                          },
                          "ocAdvTools": {
                            "type": "string"
                          },
                          "ocMvdd": {
                            "type": "string"
                          },
                          "ocMvddci": {
                            "type": "string"
                          },
                          "isOcAdvToolsOn": {
                            "type": "boolean"
                          },
                          "isOcDelayed": {
                            "type": "boolean"
                          }
                        }
                      },
                      "schedule": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "integer",
                            "example": 1
                          },
                          "name": {
                            "type": "string"
                          },
                          "color": {
                            "type": "string"
                          }
                        }
                      },
                      "userTags": {
                        "type": "array",
                        "items": {
                          "properties": {
                            "id": {
                              "type": "integer",
                              "example": 1
                            },
                            "name": {
                              "type": "string"
                            },
                            "description": {
                              "type": "string"
                            },
                            "color": {
                              "type": "string"
                            }
                          }
                        }
                      },
                      "redisData": {
                        "type": "object",
                        "properties": {
                          "ipLAN": {
                            "type": "string"
                          },
                          "ipWAN4": {
                            "type": "string"
                          },
                          "ipWAN6": {
                            "type": "string"
                          },
                          "kernel": {
                            "type": "string"
                          },
                          "driver": {
                            "type": "string"
                          },
                          "gpuCoreClk": {
                            "type": "array"
                          },
                          "gpuMemClk": {
                            "type": "array"
                          },
                          "rej": {
                            "type": "string"
                          },
                          "acc": {
                            "type": "string"
                          },
                          "hash": {
                            "type": "string"
                          },
                          "hash2": {
                            "type": "string"
                          },
                          "gpuCount": {
                            "type": "string"
                          },
                          "consoleShort": {
                            "type": "string"
                          },
                          "gpuHash": {
                            "type": "array"
                          },
                          "gpuTemp": {
                            "type": "array"
                          },
                          "gpuFan": {
                            "type": "array"
                          },
                          "gpuPwrCur": {
                            "type": "array"
                          },
                          "sysPwr": {
                            "type": "string"
                          },
                          "uptime": {
                            "type": "string"
                          }
                        }
                      },
                      "alerts": {
                        "type": "array"
                      },
                      "valueLastUpdate": {
                        "type": "integer"
                      },
                      "calculatedPeriod": {
                        "type": "integer"
                      },
                      "processUptime": {
                        "type": "integer"
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Rig List (view)."
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/rigs/user-list' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/rigs/user-list',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/filter-list": {
      "get": {
        "tags": [
          "Rig List"
        ],
        "summary": "Get Filter List",
        "description": "Get Filter List for User",
        "operationId": "getFilterListRigCollection",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "properties": {
                      "osSeries": {
                        "description": "OS Series",
                        "type": "array",
                        "items": {
                          "properties": {
                            "osSeries": {
                              "type": "string",
                              "example": "NV"
                            }
                          }
                        }
                      },
                      "rigOc": {
                        "description": "List of Group OC",
                        "type": "array",
                        "items": {
                          "properties": {
                            "id": {
                              "type": "integer",
                              "example": 1
                            },
                            "name": {
                              "type": "string"
                            }
                          }
                        }
                      },
                      "rigGroup": {
                        "description": "List of Group Config",
                        "type": "array",
                        "items": {
                          "properties": {
                            "id": {
                              "type": "integer",
                              "example": 1
                            },
                            "name": {
                              "type": "string"
                            }
                          }
                        }
                      },
                      "userTags": {
                        "description": "List of Tags",
                        "type": "array",
                        "items": {
                          "properties": {
                            "id": {
                              "type": "integer",
                              "example": 1
                            },
                            "name": {
                              "type": "string"
                            },
                            "color": {
                              "type": "string"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Rig List (view)."
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/rigs/filter-list' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/rigs/filter-list',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/summary": {
      "get": {
        "tags": [
          "Rig List"
        ],
        "summary": "Get Rigs Summary",
        "description": "Get Rigs summary details",
        "operationId": "getRigSummaryCollection",
        "parameters": [
          {
            "name": "order[name]",
            "in": "query",
            "description": "Order by name",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[hashrate]",
            "in": "query",
            "description": "Order by hashrate",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[status]",
            "in": "query",
            "description": "Order by status",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[temp]",
            "in": "query",
            "description": "Order by max temperature",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[rigOc.name]",
            "in": "query",
            "description": "Order by Group OC name",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[description]",
            "in": "query",
            "description": "Order by info",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "statusAlert",
            "in": "query",
            "description": "Filter by alerts: <br /> has_alerts - With alerts <br /> no_alerts - Without alerts <br /> reboot - Only Reboots <br /> gpu - Only Missing GPU <br /> paused - Only Paused <br /> temp - Only Temp",
            "example": "has_alerts",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "has_alerts",
                "no_alerts",
                "reboot",
                "gpu",
                "paused",
                "temp"
              ]
            }
          },
          {
            "name": "status",
            "in": "query",
            "description": "Filter by status",
            "example": "on",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "on",
                "off"
              ]
            }
          },
          {
            "name": "statusAddedTimeDelay",
            "in": "query",
            "description": "Filter by rig added within (value in seconds)",
            "example": 3600,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "statusTimeDelay",
            "in": "query",
            "description": "Filter by status OFF within (value in seconds)",
            "example": 3600,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "statusTimeGreaterThan",
            "in": "query",
            "description": "Filter by status OFF more than (value in seconds)",
            "example": 3600,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "osSeries",
            "in": "query",
            "description": "Filter by osSeries <br /> see: <a href=\"#tag/Rig/operation/getFilterListRigCollection\">Get filter List</a>",
            "example": "NV",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "rigGroup",
            "in": "query",
            "description": "Filter by Group Config ID <br /> see: <a href=\"#tag/Rig/operation/getFilterListRigCollection\">Get filter List</a>",
            "example": 1,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "rigOc",
            "in": "query",
            "description": "Filter by Group OC ID <br /> see: <a href=\"#tag/Rig/operation/getFilterListRigCollection\">Get filter List</a>",
            "example": 1,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "userTags[]",
            "in": "query",
            "description": "Filter by Tags <br /> see: <a href=\"#tag/Rig/operation/getFilterListRigCollection\">Get filter List</a>",
            "example": 1,
            "style": null,
            "required": false,
            "schema": {
              "type": "array",
              "items": {
                "type": "integer"
              }
            }
          },
          {
            "name": "search",
            "in": "query",
            "description": "Filter by name, description, OS Series, OS Version, Group Config name, Group OC name, Support ID",
            "required": false,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "all": {
                      "description": "Summary of all rigs",
                      "type": "object",
                      "properties": {
                        "online": {
                          "description": "Summary of online rigs",
                          "type": "object",
                          "properties": {
                            "paused": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "description": "Names of rigs",
                                  "type": "array",
                                  "example": [
                                    "A01",
                                    "A02"
                                  ]
                                },
                                "rigCountTotal": {
                                  "description": "Count of rigs",
                                  "type": "integer",
                                  "example": 2
                                }
                              }
                            },
                            "temp": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "description": "Names of rigs",
                                  "type": "array",
                                  "example": [
                                    "A01",
                                    "A02"
                                  ]
                                },
                                "rigCountTotal": {
                                  "description": "Count of rigs",
                                  "type": "integer",
                                  "example": 2
                                }
                              }
                            },
                            "reboot": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "description": "Names of rigs",
                                  "type": "array",
                                  "example": [
                                    "A01",
                                    "A02"
                                  ]
                                },
                                "rigCountTotal": {
                                  "description": "Count of rigs",
                                  "type": "integer",
                                  "example": 2
                                }
                              }
                            },
                            "gpu": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "type": "array",
                                  "items": {
                                    "properties": {
                                      "rigName": {
                                        "type": "string",
                                        "example": "A01"
                                      },
                                      "gpuCountMissing": {
                                        "type": "integer",
                                        "example": 2
                                      }
                                    }
                                  }
                                },
                                "rigCountTotal": {
                                  "type": "integer",
                                  "example": 1
                                },
                                "gpuCountMaxTotal": {
                                  "type": "integer",
                                  "example": 14
                                },
                                "gpuCountTotal": {
                                  "type": "integer",
                                  "example": 12
                                },
                                "gpuCountMissing": {
                                  "type": "integer",
                                  "example": 2
                                }
                              }
                            },
                            "group": {
                              "type": "array",
                              "items": {
                                "properties": {
                                  "name": {
                                    "description": "Group Config name",
                                    "type": "string"
                                  },
                                  "hashTotal": {
                                    "description": "Total hashrate in H/s",
                                    "type": "integer",
                                    "example": 120300000
                                  },
                                  "sysPwrTotal": {
                                    "description": "Total power consumption in W",
                                    "type": "integer",
                                    "example": 700
                                  }
                                }
                              }
                            },
                            "maxTemps": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "type": "array",
                                  "items": {
                                    "properties": {
                                      "rigName": {
                                        "type": "string"
                                      },
                                      "gpuTemp": {
                                        "description": "GPU temperature in Celsius",
                                        "type": "integer",
                                        "example": 68
                                      },
                                      "gpuFan": {
                                        "description": "Fan speed in %",
                                        "type": "integer",
                                        "example": 0
                                      }
                                    }
                                  }
                                },
                                "maxTemp": {
                                  "description": "Max GPU temperature in Celsius",
                                  "type": "integer",
                                  "example": 68
                                },
                                "maxFan": {
                                  "description": "Fan speed for the maxTemp in %",
                                  "type": "integer",
                                  "example": 0
                                }
                              }
                            },
                            "maxFans": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "type": "array",
                                  "items": {
                                    "properties": {
                                      "rigName": {
                                        "type": "string"
                                      },
                                      "gpuTemp": {
                                        "description": "GPU temperature in Celsius",
                                        "type": "integer",
                                        "example": 65
                                      },
                                      "gpuFan": {
                                        "description": "Fan speed in %",
                                        "type": "integer",
                                        "example": 100
                                      }
                                    }
                                  }
                                },
                                "maxTemp": {
                                  "description": "GPU temperature for maxFan in Celsius",
                                  "type": "integer",
                                  "example": 65
                                },
                                "maxFan": {
                                  "description": "Max Fan speed for in %",
                                  "type": "integer",
                                  "example": 100
                                }
                              }
                            },
                            "sysPwrTotal": {
                              "type": "integer",
                              "example": 1469
                            },
                            "hashTotal": {
                              "type": "integer",
                              "example": 249784987
                            },
                            "rigs": {
                              "description": "Always empty array",
                              "type": "array",
                              "example": []
                            },
                            "rigCountTotal": {
                              "description": "Count of online rigs",
                              "type": "integer",
                              "example": 2
                            }
                          }
                        },
                        "offline": {
                          "description": "Summary of offline rigs",
                          "type": "object",
                          "properties": {
                            "rigs": {
                              "description": "Names of offline rigs",
                              "type": "array",
                              "example": [
                                "A01",
                                "A02"
                              ]
                            },
                            "rigCountTotal": {
                              "description": "Count of offline rigs",
                              "type": "integer",
                              "example": 2
                            }
                          }
                        }
                      }
                    },
                    "filtered": {
                      "description": "Summary of filtered rigs based od passed parameters",
                      "type": "object",
                      "properties": {
                        "online": {
                          "description": "Summary of online rigs",
                          "type": "object",
                          "properties": {
                            "paused": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "description": "Names of rigs",
                                  "type": "array",
                                  "example": [
                                    "A01",
                                    "A02"
                                  ]
                                },
                                "rigCountTotal": {
                                  "description": "Count of rigs",
                                  "type": "integer",
                                  "example": 2
                                }
                              }
                            },
                            "temp": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "description": "Names of rigs",
                                  "type": "array",
                                  "example": [
                                    "A01",
                                    "A02"
                                  ]
                                },
                                "rigCountTotal": {
                                  "description": "Count of rigs",
                                  "type": "integer",
                                  "example": 2
                                }
                              }
                            },
                            "reboot": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "description": "Names of rigs",
                                  "type": "array",
                                  "example": [
                                    "A01",
                                    "A02"
                                  ]
                                },
                                "rigCountTotal": {
                                  "description": "Count of rigs",
                                  "type": "integer",
                                  "example": 2
                                }
                              }
                            },
                            "gpu": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "type": "array",
                                  "items": {
                                    "properties": {
                                      "rigName": {
                                        "type": "string",
                                        "example": "A01"
                                      },
                                      "gpuCountMissing": {
                                        "type": "integer",
                                        "example": 2
                                      }
                                    }
                                  }
                                },
                                "rigCountTotal": {
                                  "type": "integer",
                                  "example": 1
                                },
                                "gpuCountMaxTotal": {
                                  "type": "integer",
                                  "example": 14
                                },
                                "gpuCountTotal": {
                                  "type": "integer",
                                  "example": 12
                                },
                                "gpuCountMissing": {
                                  "type": "integer",
                                  "example": 2
                                }
                              }
                            },
                            "group": {
                              "type": "array",
                              "items": {
                                "properties": {
                                  "name": {
                                    "description": "Group Config name",
                                    "type": "string"
                                  },
                                  "hashTotal": {
                                    "description": "Total hashrate in H/s",
                                    "type": "integer",
                                    "example": 120300000
                                  },
                                  "sysPwrTotal": {
                                    "description": "Total power consumption in W",
                                    "type": "integer",
                                    "example": 700
                                  }
                                }
                              }
                            },
                            "maxTemps": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "type": "array",
                                  "items": {
                                    "properties": {
                                      "rigName": {
                                        "type": "string"
                                      },
                                      "gpuTemp": {
                                        "description": "GPU temperature in Celsius",
                                        "type": "integer",
                                        "example": 68
                                      },
                                      "gpuFan": {
                                        "description": "Fan speed in %",
                                        "type": "integer",
                                        "example": 0
                                      }
                                    }
                                  }
                                },
                                "maxTemp": {
                                  "description": "Max GPU temperature in Celsius",
                                  "type": "integer",
                                  "example": 68
                                },
                                "maxFan": {
                                  "description": "Fan speed for the maxTemp in %",
                                  "type": "integer",
                                  "example": 0
                                }
                              }
                            },
                            "maxFans": {
                              "type": "object",
                              "properties": {
                                "rigs": {
                                  "type": "array",
                                  "items": {
                                    "properties": {
                                      "rigName": {
                                        "type": "string"
                                      },
                                      "gpuTemp": {
                                        "description": "GPU temperature in Celsius",
                                        "type": "integer",
                                        "example": 65
                                      },
                                      "gpuFan": {
                                        "description": "Fan speed in %",
                                        "type": "integer",
                                        "example": 100
                                      }
                                    }
                                  }
                                },
                                "maxTemp": {
                                  "description": "GPU temperature for maxFan in Celsius",
                                  "type": "integer",
                                  "example": 65
                                },
                                "maxFan": {
                                  "description": "Max Fan speed for in %",
                                  "type": "integer",
                                  "example": 100
                                }
                              }
                            },
                            "sysPwrTotal": {
                              "type": "integer",
                              "example": 1469
                            },
                            "hashTotal": {
                              "type": "integer",
                              "example": 249784987
                            },
                            "rigs": {
                              "description": "Always empty array",
                              "type": "array",
                              "example": []
                            },
                            "rigCountTotal": {
                              "description": "Count of online rigs",
                              "type": "integer",
                              "example": 2
                            }
                          }
                        },
                        "offline": {
                          "description": "Summary of offline rigs",
                          "type": "object",
                          "properties": {
                            "rigs": {
                              "description": "Names of offline rigs",
                              "type": "array",
                              "example": [
                                "A01",
                                "A02"
                              ]
                            },
                            "rigCountTotal": {
                              "description": "Count of offline rigs",
                              "type": "integer",
                              "example": 2
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Rig List (view)."
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/rigs/summary' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/rigs/summary',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/{id}": {
      "get": {
        "tags": [
          "Rig List"
        ],
        "summary": "Get Rig Details",
        "description": "Get Rig Details by ID",
        "operationId": "getRigItem",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "description": "Rig ID",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 1
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "integer"
                    },
                    "supportId": {
                      "type": "string"
                    },
                    "name": {
                      "type": "string"
                    },
                    "description": {
                      "type": "string"
                    },
                    "startCount": {
                      "type": "integer"
                    },
                    "ebSerial": {
                      "type": "string"
                    },
                    "ip": {
                      "type": "string"
                    },
                    "gpuCountMax": {
                      "type": "integer"
                    },
                    "executeStatus": {
                      "type": "string"
                    },
                    "osSeries": {
                      "type": "string"
                    },
                    "osVersion": {
                      "type": "string"
                    },
                    "ocCore": {
                      "type": "string"
                    },
                    "ocMemory": {
                      "type": "string"
                    },
                    "ocPowerLimit": {
                      "type": "string"
                    },
                    "ocVddc": {
                      "type": "string"
                    },
                    "ocMode": {
                      "type": "boolean"
                    },
                    "ocTempTarget": {
                      "type": "string"
                    },
                    "ocFanSpeedMin": {
                      "type": "string"
                    },
                    "ocAdvTools": {
                      "type": "string"
                    },
                    "ocMvdd": {
                      "type": "string"
                    },
                    "ocMvddci": {
                      "type": "string"
                    },
                    "dateResetCounter": {
                      "type": "date",
                      "example": "2022-05-10T13:59:01+02:00"
                    },
                    "date": {
                      "type": "date",
                      "example": "2022-03-16T11:47:34+01:00"
                    },
                    "dateStart": {
                      "type": "date",
                      "example": "2022-03-10T09:27:30+01:00"
                    },
                    "isPaused": {
                      "type": "boolean"
                    },
                    "isOcAdvToolsOn": {
                      "type": "boolean"
                    },
                    "isOcDelayed": {
                      "type": "boolean"
                    },
                    "isOnline": {
                      "type": "boolean"
                    },
                    "srrSerial": {
                      "type": "string"
                    },
                    "srrSlot": {
                      "type": "integer"
                    },
                    "isSrrEnabled": {
                      "type": "boolean"
                    },
                    "rigGroup": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "integer"
                        },
                        "name": {
                          "type": "integer"
                        }
                      }
                    },
                    "rigOc": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "integer"
                        },
                        "name": {
                          "type": "integer"
                        }
                      }
                    },
                    "schedule": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "integer"
                        },
                        "name": {
                          "type": "integer"
                        }
                      }
                    },
                    "userTags": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "redisData": {
                      "sysRamSize": {
                        "type": "string"
                      },
                      "gpuTemp": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "driver": {
                        "type": "string"
                      },
                      "sysCpuModel": {
                        "type": "string"
                      },
                      "sysBios": {
                        "type": "string"
                      },
                      "uptime": {
                        "type": "string"
                      },
                      "hash": {
                        "type": "string"
                      },
                      "consoleDebugDate": {
                        "type": "string"
                      },
                      "ipWAN4": {
                        "type": "string"
                      },
                      "sysPwr": {
                        "type": "string"
                      },
                      "console": {
                        "description": "Base64 encoded string",
                        "type": "string"
                      },
                      "kernel": {
                        "type": "string"
                      },
                      "consoleDmesgDate": {
                        "type": "string"
                      },
                      "sysLoad5": {
                        "type": "string"
                      },
                      "ipLAN": {
                        "type": "string"
                      },
                      "sysMbo": {
                        "type": "string"
                      },
                      "ipWAN6": {
                        "type": "string"
                      },
                      "consoleShort": {
                        "type": "string"
                      },
                      "gpuCount": {
                        "type": "string"
                      },
                      "sysHdd": {
                        "type": "string"
                      },
                      "gpuFan": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      }
                    },
                    "alerts": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "gpuList": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "no": {
                            "type": "integer"
                          },
                          "model": {
                            "type": "string"
                          },
                          "core": {
                            "type": "string"
                          },
                          "mem": {
                            "type": "string"
                          },
                          "fanspeed": {
                            "type": "string"
                          },
                          "temp": {
                            "type": "string"
                          },
                          "asicTemp": {
                            "type": "string"
                          },
                          "memTemp": {
                            "type": "string"
                          },
                          "gpuPciBus": {
                            "type": "string"
                          },
                          "gpuVramSize": {
                            "type": "string"
                          },
                          "gpuVramType": {
                            "type": "string"
                          },
                          "gpuVramChip": {
                            "type": "string"
                          },
                          "gpuBiosVer": {
                            "type": "string"
                          },
                          "gpuPwrMin": {
                            "type": "string"
                          },
                          "gpuPwrMax": {
                            "type": "string"
                          },
                          "gpuPwrLimit": {
                            "type": "string"
                          },
                          "gpuPwrCur": {
                            "type": "string"
                          },
                          "gpuVddGfx": {
                            "type": "string"
                          },
                          "gpuManufacturer": {
                            "type": "string"
                          },
                          "gpuMvdd": {
                            "type": "string"
                          },
                          "gpuMvddci": {
                            "type": "string"
                          },
                          "hashrate": {
                            "type": "string"
                          },
                          "hashrate2": {
                            "type": "string"
                          },
                          "gpuHash": {
                            "type": "string"
                          },
                          "gpuHash2": {
                            "type": "string"
                          }
                        }
                      },
                      "valueLastUpdate": {
                        "type": "integer"
                      },
                      "calculatedPeriod": {
                        "type": "integer"
                      },
                      "processUptime": {
                        "type": "integer"
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "$ref": "#/components/responses/403"
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/rigs/1' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/rigs/1',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      },
      "delete": {
        "tags": [
          "Rig List"
        ],
        "summary": "Delete Rig",
        "description": "Delete Rig by ID",
        "operationId": "deleteRigItem",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "description": "Rig ID",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 1
            }
          }
        ],
        "responses": {
          "204": {
            "description": "No Content"
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "$ref": "#/components/responses/403"
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request DELETE 'https://api.simplemining.net/rigs/1' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/rigs/1',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'DELETE',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/{id}/console": {
      "get": {
        "tags": [
          "Rig List"
        ],
        "summary": "Get Rig Console",
        "description": "Get Rig Console by ID",
        "operationId": "getConsoleRigItem",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "description": "Rig ID",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 1
            }
          },
          {
            "name": "type",
            "in": "query",
            "description": "Console Type",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "debug",
                "dmesg"
              ]
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "console": {
                      "description": "Base64 encoded string",
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "$ref": "#/components/responses/403"
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/rigs/1/console' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/rigs/1/console',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/change-rig-group": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Change Group Config",
        "description": "Change Group Config in Rigs by Rig IDs",
        "operationId": "patchChangeRigGroupCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigGroupId": {
                    "description": "Group Config ID",
                    "type": "integer",
                    "required": true,
                    "example": 7
                  },
                  "execute": {
                    "description": "Provide additional execute command: <br /> reload - reload rigs after change <br /> reboot - reboot rigs after change",
                    "type": "string",
                    "example": "reload"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Group Config (assign)."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/change-rig-group' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3],\n    \"rigGroupId\": 7,\n    \"execute\": \"reload\"\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n    'rigGroupId' => 7,\n    'execute' => 'reload',\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/change-rig-group',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/change-rig-oc": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Change Group OC",
        "description": "Change Group OC in Rigs by Rig IDs",
        "operationId": "patchChangeRigOcCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Group OC ID",
                    "type": "integer",
                    "required": true,
                    "example": 7
                  },
                  "action": {
                    "description": "Provide action type: <br /> link - change Group OC on given rigs <br /> unlink - remove Group OC from given rigs",
                    "type": "string",
                    "example": "link"
                  },
                  "execute": {
                    "description": "Provide execute command: <br /> reload - reload rigs after change <br /> reboot - reboot rigs after change",
                    "type": "string",
                    "example": "reload"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Group OC (set/change group for rigs)."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/change-rig-oc' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3],\n    \"rigOcId\": 7,\n    \"action\": \"link\",\n    \"execute\": \"reload\"\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n    'rigGroupId' => 7,\n    'action' => 'link',\n    'execute' => 'reload',\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/change-rig-oc',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-reboot": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Reboot",
        "description": "Execute Reboot on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecuteRebootCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Provide Group OC ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupId": {
                    "description": "Provide Group Config ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupIds": {
                    "description": "Provide Group Config IDs to apply change on Rigs within this groups",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Reboot rigs in Group Config (write), Reboot rigs in Group OC (write), Reboot rig."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-reboot' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3]\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-reboot',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-reload": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Reload",
        "description": "Execute Reload on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecuteReloadCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Provide Group OC ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupId": {
                    "description": "Provide Group Config ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupIds": {
                    "description": "Provide Group Config IDs to apply change on Rigs within this groups",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Reload rigs in Group Config (write), Reload rigs in Group OC (write), Reload rig."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-reload' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3]\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-reload',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-pause": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Pause",
        "description": "Execute Pause on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecutePauseCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Provide Group OC ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupId": {
                    "description": "Provide Group Config ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupIds": {
                    "description": "Provide Group Config IDs to apply change on Rigs within this groups",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Pause/Resume mining."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-pause' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3]\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-pause',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-resume": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Resume",
        "description": "Execute Resume on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecuteResumeCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Provide Group OC ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupId": {
                    "description": "Provide Group Config ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupIds": {
                    "description": "Provide Group Config IDs to apply change on Rigs within this groups",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Pause/Resume mining."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-resume' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3]\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-resume',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-rig-detect": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Find Rig",
        "description": "Execute Find Rig on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecuteRigDetectCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Provide Group OC ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupId": {
                    "description": "Provide Group Config ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupIds": {
                    "description": "Provide Group Config IDs to apply change on Rigs within this groups",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Find Rig."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-rig-detect' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3]\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-rig-detect',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-rig-gpu-detect": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Find GPU",
        "description": "Execute Find GPU on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecuteRigGpuDetectCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Provide Group OC ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupId": {
                    "description": "Provide Group Config ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupIds": {
                    "description": "Provide Group Config IDs to apply change on Rigs within this groups",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "gpuId": {
                    "description": "Number starting of 0",
                    "type": "integer",
                    "required": true,
                    "example": 0
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Find GPU."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-rig-gpu-detect' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3]\n    \"gpuId\": 0\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n    'gpuId' => 0,\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-rig-gpu-detect',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-shutdown": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Shutdown",
        "description": "Execute Shutdown on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecuteShutdownCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Provide Group OC ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupId": {
                    "description": "Provide Group Config ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupIds": {
                    "description": "Provide Group Config IDs to apply change on Rigs within this groups",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Power off rig."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-shutdown' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3]\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-shutdown',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-sleep": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Sleep",
        "description": "Execute Sleep on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecuteSleepCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Provide Group OC ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupId": {
                    "description": "Provide Group Config ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupIds": {
                    "description": "Provide Group Config IDs to apply change on Rigs within this groups",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "minutes": {
                    "description": "Number of minutes",
                    "type": "integer",
                    "example": 1
                  },
                  "hours": {
                    "description": "Number of hours",
                    "type": "integer",
                    "example": 1
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Sleep."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-sleep' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3]\n    \"minutes\": 1\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n    'minutes' => 1,\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-sleep',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-clear-counter": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Clear Counter",
        "description": "Execute Clear Counter on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecuteClearCounterCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Provide Group OC ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupId": {
                    "description": "Provide Group Config ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupIds": {
                    "description": "Provide Group Config IDs to apply change on Rigs within this groups",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Clear counters."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-clear-counter' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3]\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-clear-counter',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-delete": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Delete",
        "description": "Execute Delete on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecuteDeleteCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Delete rig (multiple)."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-delete' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3]\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-delete',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rigs/execute-command": {
      "patch": {
        "tags": [
          "Rig List"
        ],
        "summary": "Execute Command",
        "description": "Execute Command on Rigs by Rig IDs, Group OC ID or Group Config ID",
        "operationId": "patchExecuteCommandCollection",
        "parameters": [
          {
            "name": "Content-Type",
            "in": "header",
            "example": "application/merge-patch+json",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/merge-patch+json": {
              "schema": {
                "type": "object",
                "properties": {
                  "rigIds": {
                    "description": "Provide Rig IDs to apply change on selected Rigs",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "rigOcId": {
                    "description": "Provide Group OC ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupId": {
                    "description": "Provide Group Config ID to apply change on Rigs within this group",
                    "type": "integer",
                    "example": 1
                  },
                  "rigGroupIds": {
                    "description": "Provide Group Config IDs to apply change on Rigs within this groups",
                    "type": "array",
                    "example": [
                      1,
                      2,
                      3
                    ]
                  },
                  "commandId": {
                    "description": "Command ID",
                    "type": "integer",
                    "required": true,
                    "example": 7
                  },
                  "commandOptions": {
                    "description": "Provide command options when applicable",
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "example": {}
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "rigIds, rigOcId, rigGroupId not provided."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Advanced command."
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/404"
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request PATCH 'https://api.simplemining.net/rigs/execute-command' \\\n--header 'Content-Type: application/merge-patch+json' \\\n--header 'X-AUTH-TOKEN: apiKey' \\\n--data-raw '{\n    \"rigIds\": [1,2,3],\n    \"commandId\": 7\n}'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n$data = [\n    'rigIds' => [1, 2, 3],\n    'commandId' => 7,\n];\n\ntry {\n    curl_setopt_array($curl, [\n        CURLOPT_URL => 'https://api.simplemining.net/rigs/execute-command',\n        CURLOPT_RETURNTRANSFER => true,\n        CURLOPT_ENCODING => '',\n        CURLOPT_MAXREDIRS => 10,\n        CURLOPT_TIMEOUT => 0,\n        CURLOPT_FOLLOWLOCATION => true,\n        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n        CURLOPT_CUSTOMREQUEST => 'PATCH',\n        CURLOPT_POSTFIELDS => json_encode($data, JSON_THROW_ON_ERROR),\n        CURLOPT_HTTPHEADER => ['Content-Type: application/merge-patch+json', 'X-AUTH-TOKEN: apiKey'],\n    ]);\n} catch (JsonException $e) {\n}\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rig-commands": {
      "get": {
        "tags": [
          "Commands"
        ],
        "summary": "Get available commands",
        "description": "Get available commands to execute on rig",
        "operationId": "getRigCommandCollection",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "properties": {
                      "id": {
                        "description": "ID",
                        "type": "integer",
                        "x-nullable": false,
                        "example": 7
                      },
                      "cmd": {
                        "description": "Command code name",
                        "type": "string",
                        "x-nullable": false,
                        "example": "cmdBash"
                      },
                      "name": {
                        "description": "Command name",
                        "type": "string",
                        "x-nullable": false,
                        "example": "Bash"
                      },
                      "description": {
                        "description": "Command description",
                        "type": "string",
                        "x-nullable": false
                      },
                      "isCustom": {
                        "description": "Is command with custom options",
                        "type": "bool",
                        "x-nullable": false,
                        "example": true
                      },
                      "isPublic": {
                        "description": "Is command public - always true",
                        "type": "bool",
                        "x-nullable": false,
                        "example": true
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Advanced command."
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/rig-commands' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/rig-commands',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rig-groups/user-list": {
      "get": {
        "tags": [
          "Group Config"
        ],
        "summary": "Get available Group Configs",
        "description": "Get available Group Configs",
        "operationId": "getRigGroupCollection",
        "parameters": [
          {
            "name": "itemsPerPage",
            "in": "query",
            "description": "Number of items returned",
            "example": 100,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "page",
            "in": "query",
            "description": "Number of page",
            "example": 1,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "order[name]",
            "in": "query",
            "description": "Order by name",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[rigsCount]",
            "in": "query",
            "description": "Order by rigs count",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[minerProgram.name]",
            "in": "query",
            "description": "Order by miner program name",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "search",
            "in": "query",
            "description": "Filter by name, description",
            "required": false,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "properties": {
                      "id": {
                        "description": "ID",
                        "type": "integer",
                        "x-nullable": false,
                        "example": 7
                      },
                      "name": {
                        "description": "Group config name",
                        "type": "string",
                        "x-nullable": false,
                        "example": "0-AMD-TRM"
                      },
                      "description": {
                        "description": "Group config notes",
                        "type": "string",
                        "x-nullable": false
                      },
                      "minerOptions": {
                        "description": "Miner options",
                        "type": "string",
                        "x-nullable": false
                      },
                      "isDefault": {
                        "description": "Is Group Config default group",
                        "type": "bool",
                        "x-nullable": false,
                        "example": true
                      },
                      "isRootMiner": {
                        "description": "Should miner be executed as root user",
                        "type": "bool",
                        "x-nullable": false,
                        "example": true
                      },
                      "minerProgram": {
                        "type": "array",
                        "items": {
                          "properties": {
                            "name": {
                              "description": "Miner name",
                              "type": "string",
                              "x-nullable": false
                            },
                            "createdAt": {
                              "description": "Created date",
                              "type": "date",
                              "x-nullable": false,
                              "example": "2022-01-13T21:25:45+01:00"
                            }
                          }
                        }
                      },
                      "rigsTotalCount": {
                        "description": "Total rigs within Group Config",
                        "type": "integer",
                        "x-nullable": false,
                        "example": 40
                      },
                      "rigsOnlineCount": {
                        "description": "Online rigs within Group Config",
                        "type": "integer",
                        "x-nullable": false,
                        "example": 3
                      },
                      "createdAt": {
                        "description": "Created date",
                        "type": "date",
                        "x-nullable": false,
                        "example": "2022-01-13T21:25:45+01:00"
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Group Config List (view)."
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/rig-groups/user-list' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/rig-groups/user-list',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    },
    "/rig-ocs/user-list": {
      "get": {
        "tags": [
          "Group OC"
        ],
        "summary": "Get available Group OCs",
        "description": "Get available Group OCs",
        "operationId": "getRigOcCollection",
        "parameters": [
          {
            "name": "itemsPerPage",
            "in": "query",
            "description": "Number of items returned",
            "example": 100,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "page",
            "in": "query",
            "description": "Number of page",
            "example": 1,
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "order[name]",
            "in": "query",
            "description": "Order by name",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[rigsCount]",
            "in": "query",
            "description": "Order by rigs count",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[ocCore]",
            "in": "query",
            "description": "Order by core",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[ocMemory]",
            "in": "query",
            "description": "Order by memory",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[ocVddc]",
            "in": "query",
            "description": "Order by core voltage",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[ocMvdd]",
            "in": "query",
            "description": "Order by MVDD",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[ocMvddci]",
            "in": "query",
            "description": "Order by MVDDCI",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[ocMode]",
            "in": "query",
            "description": "Order by aggressive undervolt",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[ocPowerLimit]",
            "in": "query",
            "description": "Order by power stage (RX) or power limit (NV)",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[ocTempTarget]",
            "in": "query",
            "description": "Order by target temp",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[ocFanSpeedMin]",
            "in": "query",
            "description": "Order by min fan speed",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "order[isOcAdvToolsOn]",
            "in": "query",
            "description": "Order by advanced tools",
            "example": "desc",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ]
            }
          },
          {
            "name": "osSeries",
            "in": "query",
            "description": "Filter by osSeries: <br /> RX - AMD rigs <br /> NV - Nvidia rigs <br /> R - very old AMD (HD7000/R200) rigs",
            "example": "has_alerts",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "RX",
                "NV",
                "R"
              ]
            }
          },
          {
            "name": "search",
            "in": "query",
            "description": "Filter by name, description",
            "required": false,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "properties": {
                      "id": {
                        "description": "ID",
                        "type": "integer",
                        "x-nullable": false,
                        "example": 7
                      },
                      "name": {
                        "description": "Group OC name",
                        "type": "string",
                        "x-nullable": false,
                        "example": "0-AMD-TRM"
                      },
                      "description": {
                        "description": "Group OC notes",
                        "type": "string",
                        "x-nullable": false
                      },
                      "osSeries": {
                        "description": "OS Series (RX, NV, R)",
                        "type": "string",
                        "x-nullable": false
                      },
                      "ocCore": {
                        "description": "Core",
                        "type": "string",
                        "x-nullable": false
                      },
                      "ocMemory": {
                        "description": "Memory",
                        "type": "string",
                        "x-nullable": false
                      },
                      "ocPowerLimit": {
                        "description": "Power stage (RX) or power limit (NV)",
                        "type": "string",
                        "x-nullable": false
                      },
                      "ocVddc": {
                        "description": "Power stage (RX) or power limit (NV)",
                        "type": "string",
                        "x-nullable": false
                      },
                      "ocMode": {
                        "description": "Is Aggressive Undervolt on",
                        "type": "bool",
                        "x-nullable": false,
                        "example": true
                      },
                      "ocTempTarget": {
                        "description": "Target temperature",
                        "type": "string",
                        "x-nullable": false
                      },
                      "ocFanSpeedMin": {
                        "description": "Minimum fan speed",
                        "type": "string",
                        "x-nullable": false
                      },
                      "ocMvdd": {
                        "description": "Memory voltage MVDD [mV]",
                        "type": "string",
                        "x-nullable": false
                      },
                      "ocMvddci": {
                        "description": "Memory voltage MVDDCI [mV]",
                        "type": "string",
                        "x-nullable": false
                      },
                      "isDefault": {
                        "description": "Is Group Config default group",
                        "type": "bool",
                        "x-nullable": false,
                        "example": true
                      },
                      "isOcAdvToolsOn": {
                        "description": "Is Advanced Tools on",
                        "type": "bool",
                        "x-nullable": false,
                        "example": true
                      },
                      "isOcDelayed": {
                        "description": "Is Group Config default group",
                        "type": "bool",
                        "x-nullable": false,
                        "example": true
                      },
                      "rigsTotalCount": {
                        "description": "Total rigs within Group Config",
                        "type": "integer",
                        "x-nullable": false,
                        "example": 40
                      },
                      "rigsOnlineCount": {
                        "description": "Online rigs within Group Config",
                        "type": "integer",
                        "x-nullable": false,
                        "example": 3
                      },
                      "createdAt": {
                        "description": "Created date",
                        "type": "date",
                        "x-nullable": false,
                        "example": "2022-01-13T21:25:45+01:00"
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/401"
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/Error"
                    },
                    {
                      "properties": {
                        "detail": {
                          "example": "You need one of these permissions: Group OC List (view)."
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "x-codeSamples": [
          {
            "lang": "cURL",
            "label": "CLI",
            "source": "curl --location --request GET 'https://api.simplemining.net/rig-ocs/user-list' \\\n--header 'X-AUTH-TOKEN: apiKey'\n"
          },
          {
            "lang": "PHP",
            "source": "<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n    CURLOPT_URL => 'https://api.simplemining.net/rig-ocs/user-list',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_ENCODING => '',\n    CURLOPT_MAXREDIRS => 10,\n    CURLOPT_TIMEOUT => 0,\n    CURLOPT_FOLLOWLOCATION => true,\n    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n    CURLOPT_CUSTOMREQUEST => 'GET',\n    CURLOPT_HTTPHEADER => ['X-AUTH-TOKEN: apiKey'],\n]);\n\n$response = curl_exec($curl);\n\ncurl_close($curl);\necho $response;\n"
          }
        ]
      }
    }
  },
  "x-tagGroups": [
    {
      "name": "Mining",
      "tags": [
        "Rig List",
        "Group Config",
        "Group OC",
        "Commands",
        "Deposit Fee"
      ]
    }
  ]
}