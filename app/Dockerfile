FROM public.ecr.aws/docker/library/python:3.13

RUN pip3 install poetry \
    && apt update \
    && apt install -y postgresql-common \
    && yes | /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh \
    && apt install -y postgresql-client-16

# Workaround to add bind mount on fargate launch type which doesn't support tmpfs:
# https://docs.aws.amazon.com/AmazonECS/latest/developerguide/bind-mounts.html
RUN useradd tmp
RUN mkdir -p /tmp && chown tmp:tmp /tmp && chown tmp:tmp /home
USER tmp
VOLUME ["/tmp"]

WORKDIR /app

COPY . .
RUN poetry install --no-interaction --no-root

ENTRYPOINT ["poetry", "run", "main"]
