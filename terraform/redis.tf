resource "aws_elasticache_subnet_group" "redis" {
  name       = "verdexis-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "verdexis-redis"
  replication_group_description = "Verdexis Redis cluster"
  node_type                     = var.redis_node_type
  number_cache_clusters         = 1
  automatic_failover_enabled    = false
  subnet_group_name             = aws_elasticache_subnet_group.redis.name
  security_group_ids            = [aws_security_group.redis.id]
  tags = { Name = "verdexis-redis" }
}
