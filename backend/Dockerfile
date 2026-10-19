FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -g 1000 pocketbase \
    && adduser -D -u 1000 -G pocketbase pocketbase
WORKDIR /pb
COPY --chmod=755 pocketbase /pb/pocketbase
COPY pb_migrations /pb/pb_migrations
RUN mkdir -p /pb/pb_data && chown -R pocketbase:pocketbase /pb
USER pocketbase
EXPOSE 8090
ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations"]
