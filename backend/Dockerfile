FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk --no-cache add git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o mantra-backend .

FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata wget

WORKDIR /app
COPY --from=builder /app/mantra-backend .

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["./mantra-backend"]
