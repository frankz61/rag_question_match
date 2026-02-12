/*
 Navicat Premium Data Transfer

 Source Server         : localhost_docker_db
 Source Server Type    : MySQL
 Source Server Version : 80045 (8.0.45)
 Source Host           : localhost:3306
 Source Schema         : test_rag

 Target Server Type    : MySQL
 Target Server Version : 80045 (8.0.45)
 File Encoding         : 65001

 Date: 11/02/2026 14:04:19
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for papers
-- ----------------------------
DROP TABLE IF EXISTS `papers`;
CREATE TABLE `papers`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_key` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '学科标识，例如 en/zh/math',
  `stage_key` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '学段标识，例如 primary/junior/senior',
  `grade_key` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '年级或届别，可选',
  `book_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `book_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '目录名称，例如 名师秘籍 小学',
  `class_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `source` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '来源/渠道/上传者备注',
  `import_batch` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '导入批次或任务ID',
  `total_pages` int UNSIGNED NULL DEFAULT NULL,
  `notes` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `process_status` enum('pending_cut','pending_review','reviewing','completed','inbound_success','inbound_failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending_review',
  `answer_type` enum('no','mix','tail','unknown') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `is_image` tinyint UNSIGNED NOT NULL DEFAULT 0 COMMENT '是否为图片试卷 0-否 1-是',
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  `inbound_at` timestamp NULL DEFAULT NULL COMMENT '入库时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否已归档：0-未归档，1-已归档',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_papers_subject_stage`(`subject_key` ASC, `stage_key` ASC) USING BTREE,
  INDEX `idx_papers_created_by`(`created_by` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2211 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for question_ocr_results
-- ----------------------------
DROP TABLE IF EXISTS `question_ocr_results`;
CREATE TABLE `question_ocr_results`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `paper_id` bigint UNSIGNED NOT NULL,
  `box_id` bigint UNSIGNED NOT NULL,
  `result_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_modified` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否被修改过：0-未修改，1-内容有变化时设置为已修改',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_qocr_box`(`box_id` ASC) USING BTREE,
  INDEX `idx_qocr_paper`(`paper_id` ASC) USING BTREE,
  CONSTRAINT `fk_qocr_box` FOREIGN KEY (`box_id`) REFERENCES `boxes` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_qocr_paper` FOREIGN KEY (`paper_id`) REFERENCES `papers` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 41735 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

SET FOREIGN_KEY_CHECKS = 1;
