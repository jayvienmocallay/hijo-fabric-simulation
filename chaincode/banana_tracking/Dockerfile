FROM golang:1.20-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o chaincode .

FROM alpine:3.18
WORKDIR /app
COPY --from=builder /app/chaincode /app/chaincode
EXPOSE 9999
CMD ["/app/chaincode"]
