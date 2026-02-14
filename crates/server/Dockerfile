FROM rust:1.84-slim-bookworm as builder

WORKDIR /usr/src/app

# Install build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev libglib2.0-dev libgdk-pixbuf2.0-dev libgtk-3-dev libsoup-3.0-dev libwebkit2gtk-4.1-dev && rm -rf /var/lib/apt/lists/*
ENV PKG_CONFIG_ALLOW_CROSS=1

# Verify pkg-config finds the libraries
RUN pkg-config --print-errors --exists glib-2.0 gobject-2.0
RUN pkg-config --cflags --libs glib-2.0 gobject-2.0

COPY . .

# Build the server binary
# We need to point to the specific bin because the workspace structure might build all
RUN cargo build --release --bin server

FROM debian:bookworm-slim

WORKDIR /app

# Install necessary runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates libssl-dev libgtk-3-0 libsoup-3.0-0 libwebkit2gtk-4.1-0 && rm -rf /var/lib/apt/lists/*

# Copy the binary from the builder stage
COPY --from=builder /usr/src/app/target/release/server /app/server

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

CMD ["./server"]

