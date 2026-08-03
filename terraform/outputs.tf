output "ecr_repository_url" {
  value = aws_ecr_repository.verdexis_server.repository_url
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.address
}

output "rds_port" {
  value = aws_db_instance.postgres.port
}

output "redis_primary_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "alb_dns" {
  value = aws_lb.alb.dns_name
}

output "ecs_cluster" {
  value = aws_ecs_cluster.cluster.id
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db_credentials.arn
}
