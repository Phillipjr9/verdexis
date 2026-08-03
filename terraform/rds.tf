resource "random_password" "db_password" {
  length  = 20
  special = true
}

resource "aws_db_subnet_group" "rds" {
  name       = "verdexis-rds-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "postgres" {
  identifier                 = "verdexis-db"
  allocated_storage         = var.db_allocated_storage
  engine                    = "postgres"
  engine_version            = var.db_engine_version
  instance_class            = var.db_instance_class
  name                      = var.db_name
  username                  = var.db_username
  password                  = random_password.db_password.result
  skip_final_snapshot       = true
  publicly_accessible       = false
  vpc_security_group_ids    = [aws_security_group.rds.id]
  db_subnet_group_name      = aws_db_subnet_group.rds.name
  iam_database_authentication_enabled = true
  tags = { Name = "verdexis-postgres" }
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name = "verdexis-db-credentials"
}

resource "aws_secretsmanager_secret_version" "db_credentials_version" {
  secret_id     = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = aws_db_instance.postgres.username,
    password = random_password.db_password.result,
    host     = aws_db_instance.postgres.address,
    port     = aws_db_instance.postgres.port,
    dbname   = aws_db_instance.postgres.name
  })
}
