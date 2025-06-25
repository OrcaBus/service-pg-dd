FROM public.ecr.aws/docker/library/python:3.13

RUN pip3 install poetry && apt update && apt -y install postgresql-client

WORKDIR /app

COPY . .
RUN poetry install --no-interaction --no-root

ENTRYPOINT ["poetry", "run", "cli"]
