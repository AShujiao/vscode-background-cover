enum FileType {
    /**
     * 未修改的文件
     */
    empty,
    /**
     * hack 过的旧版本文件
     */
    isOld,
    /**
     * hack 过的新版本的文件
     */
    isNew
}

export default FileType;