variable "aws_region" {
  type    = string
  default = "us-east-2"
}

variable "ecr_repo_name" {
  type    = string
  default = "verdexis-server"
}

variable "aws_account_id" {
  type = string
}

variable "cluster_name" {
  type    = string
  default = "verdexis-prod"
}

variable "service_name" {
  type    = string
  default = "verdexis-service"
}

variable "container_image" {
  type    = string
  default = ""
}

variable "task_cpu" {
  type    = string
  default = "512"
}

variable "task_memory" {
  type    = string
  default = "1024"
}

variable "service_desired_count" {
  type    = number
  default = 1
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnets" {
  type    = list(string)
  default = ["10.0.0.0/24","10.0.1.0/24"]
}

variable "private_subnets" {
  type    = list(string)
  default = ["10.0.10.0/24","10.0.11.0/24"]
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_engine_version" {
  type    = string
  default = "15.4"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_name" {
  type    = string
  default = "postgres"
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}
